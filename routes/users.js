var express = require("express");
var router = express.Router();
const Post = require("../models/Post");
const Comment = require("../models/Comment");
const multer = require("multer");
const User = require("../models/User");
const upload = multer({ dest: "public/images/uploads/" });

const auth = function (req, res, next) {
  if (req.session.user) {
    next();
  } else {
    res.redirect("/login");
  }
};
/* GET users listing. */
router.get("/", auth, function (req, res, next) {
  Post.countDocuments({ author: req.session.user.id }, (err, rtn) => {
    if (err) throw err;
    Post.countDocuments(
      { "like.user": { $in: req.session.user.id } },
      (err2, rtn2) => {
        if (err2) throw err2;
        User.findById(req.session.user.id)
          .select("favoriteB")
          .exec((err3, rtn3) => {
            if (err3) throw err3;
            Comment.countDocuments(
              { commenter: req.session.user.id },
              (err4, rtn4) => {
                if (err4) throw err4;
                res.render("user/index", {
                  postCount: rtn,
                  likeCount: rtn2,
                  favCount: rtn3,
                  commentCount: rtn4,
                });
              }
            );
          });
      }
    );
  });
});

router.get("/postadd", auth, function (req, res) {
  res.render("user/postadd");
});

router.post("/postadd", auth, upload.single("photo"), function (req, res) {
  let post = new Post();
  post.title = req.body.title;
  post.content = req.body.content;
  post.author = req.session.user.id;
  post.created = Date.now();
  post.updated = Date.now();
  if (req.file) post.image = "/images/uploads/" + req.file.filename;
  post.save(function (err, rtn) {
    if (err) throw err;
    console.log(rtn);
    res.redirect("/");
  });
});

router.get("/myposts", auth, function (req, res) {
  Post.find({ author: req.session.user.id })
    .populate("author")
    .exec(function (err, rtn) {
      if (err) throw err;
      console.log(rtn);
      res.render("user/postlist", { posts: rtn });
    });
});

router.get("/postupdate/:id", auth, function (req, res) {
  Post.findOne(
    { _id: req.params.id, author: req.session.user.id },
    function (err, rtn) {
      if (err) throw err;
      if (rtn != null) res.render("user/postupdate", { post: rtn });
      else res.redirect("/users/myposts");
    }
  );
});

router.post("/postupdate", auth, upload.single("photo"), function (req, res) {
  let update = {
    title: req.body.title,
    content: req.body.content,
    updated: Date.now(),
  };
  if (req.file) update.image = "/images/uploads/" + req.file.filename;
  Post.findOneAndUpdate(
    { _id: req.body.id, author: req.session.user.id },
    { $set: update },
    function (err, rtn) {
      if (err) throw err;
      res.redirect("/users/myposts");
    }
  );
});

router.get("/postdelete/:id", auth, function (req, res) {
  Post.findOneAndDelete(
    { _id: req.params.id, author: req.session.user.id },
    function (err, rtn) {
      if (err) throw err;
      Comment.deleteMany(
        { post: req.params.id, author: req.session.user.id },
        (err2, rtn2) => {
          if (err2) throw err2;
          res.redirect("/users/myposts");
        }
      );
    }
  );
});

router.post("/givecomment", auth, function (req, res) {
  const comment = new Comment();
  comment.author = req.body.author;
  comment.post = req.body.post;
  comment.comment = req.body.comment;
  comment.commenter = req.session.user.id;
  comment.created = Date.now();
  comment.updated = Date.now();
  comment.save((err, rtn) => {
    console.log(rtn);
    if (err) {
      res.json({
        status: "error",
      });
    } else {
      res.json({
        status: true,
      });
    }
  });
});

router.get("/postdetail/:id", auth, function (req, res) {
  Post.findOne(
    { _id: req.params.id, author: req.session.user.id },
    (err, rtn) => {
      if (err) throw err;
      if (rtn != null) {
        Comment.find({ post: req.params.id })
          .populate("commenter", "name")
          .select("comment reply author created")
          .exec((err2, rtn2) => {
            if (err2) throw err2;
            res.render("user/postdetail", { post: rtn, comments: rtn2 });
          });
      } else {
        res.redirect("/users/myposts");
      }
    }
  );
});

router.post("/givereply", auth, function (req, res) {
  const update = {
    reply: req.body.reply,
    updated: Date.now(),
  };
  console.log(req.body, update);
  Comment.findByIdAndUpdate(req.body.comment, { $set: update }, (err, rtn) => {
    if (err) {
      res.json({
        status: "error",
      });
    } else {
      console.log(rtn);
      res.json({
        status: true,
      });
    }
  });
});

router.post("/givelike", auth, (req, res) => {
  if (req.body.action === "like") {
    Post.findByIdAndUpdate(
      req.body.pid,
      { $push: { like: { user: req.session.user.id } } },
      (err, rtn) => {
        if (err) {
          res.json({
            status: "error",
          });
        } else {
          console.log(rtn);
          res.json({
            status: true,
          });
        }
      }
    );
  } else {
    Post.findById(req.body.pid, (err, rtn) => {
      if (err) {
        res.json({
          status: "error",
        });
      } else {
        const likelist = rtn.like.filter(function (data) {
          return data.user != req.session.user.id;
        });
        Post.findByIdAndUpdate(
          req.body.pid,
          { $set: { like: likelist } },
          (err2, rtn2) => {
            if (err2) {
              res.json({
                status: "error",
              });
            } else {
              res.json({
                status: true,
              });
            }
          }
        );
      }
    });
  }
});

router.post("/givefav", auth, (req, res) => {
  if (req.body.action == "fav") {
    User.findByIdAndUpdate(
      req.session.user.id,
      { $push: { favoriteB: { blogger: req.body.aid } } },
      (err, rtn) => {
        if (err) {
          res.json({
            status: "error",
          });
        } else {
          console.log(rtn);
          res.json({
            status: true,
          });
        }
      }
    );
  } else {
    User.findById(req.session.user.id, (err, rtn) => {
      if (err) {
        res.json({
          status: "error",
        });
      } else {
        let bloggerlist = rtn.favoriteB.filter(function (data) {
          return data.blogger != req.body.aid;
        });
        User.findByIdAndUpdate(
          req.session.user.id,
          { $set: { favoriteB: bloggerlist } },
          (err2, rtn2) => {
            if (err2) {
              res.json({
                status: "error",
              });
            } else {
              res.json({
                status: true,
              });
            }
          }
        );
      }
    });
  }
});

router.get("/favbloglist", auth, function (req, res) {
  User.findById(req.session.user.id, (err, rtn) => {
    if (err) throw err;
    let favlist = [];
    rtn.favoriteB.forEach((element) => {
      favlist.push(element.blogger);
    });
    Post.find({ author: { $in: favlist } }, (err2, rtn2) => {
      if (err2) throw err2;
      res.render("user/favbloglist", { posts: rtn2 });
    });
  });
});

module.exports = router;
