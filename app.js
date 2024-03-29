//getting all requirements
const express = require("express");
var csrf = require("tiny-csrf");
var cookieParser = require("cookie-parser");
const app = express();
const { Todo, User } = require("./models");
const bodyParser = require("body-parser");
const passport = require("passport");
const connectEnsureLogin = require("connect-ensure-login");
const session = require("express-session");
const LocalStrategy = require("passport-local");
const bcrypt = require("bcrypt");
const saltRounds = 10;
app.use(bodyParser.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser("shh! some secret string"));
app.use(csrf("this_should_be_32_character_long", ["POST", "PUT", "DELETE"]));
const path = require("path");
// eslint-disable-next-line no-undef
app.use(express.static(path.join(__dirname, "public")));
const flash = require("connect-flash");
// eslint-disable-next-line no-undef
app.set("views", path.join(__dirname, "views"));
app.use(flash());
app.set("view engine", "ejs");
app.use(
  session({
    secret: "my-secret-super-key-10181810",
    cookie: {
      maxAge: 24 * 60 * 60 * 1000,
    },
  })
);
app.use(function (request, response, next) {
  response.locals.messages = request.flash();
  next();
});
app.use(passport.initialize());
app.use(passport.session());
passport.use(
  new LocalStrategy(
    {
      usernameField: "email",
      passwordField: "password",
    },
    (username, password, done) => {
      User.findOne({ where: { email: username } })
        .then(async (user) => {
          const result = await bcrypt.compare(password, user.password);
          if (result) {
            return done(null, user);
          } else {
            return done(null, false, { message: "Invalid Password" });
          }
        })
        .catch(function () {
          return done(null, false, { message: "Unrecognized Email" });
        });
    }
  )
);
passport.serializeUser((user, done) => {
  console.log("Serializing user in session", user.id);
  done(null, user.id);
});
passport.deserializeUser((id, done) => {
  User.findByPk(id)
    .then((user) => {
      done(null, user);
    })
    .catch((error) => {
      done(error, null);
    });
});
app.get(
  "/todos",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    try {
      const loggedInUserId = request.user.id;
      const overduetodos = await Todo.overdue(loggedInUserId);
      const duetodaytodos = await Todo.dueToday(loggedInUserId);
      const duelatertodos = await Todo.dueLater(loggedInUserId);
      const completedtodos = await Todo.completedTodos(loggedInUserId);
      const firstName = request.user.firstName;
      const lastName = request.user.lastName;
      const userName = firstName +" "+ lastName;

      if (request.accepts("html")) {
        response.render("todos", {
          title: "To-Do Manager",
          overduetodos,
          duetodaytodos,
          duelatertodos,
          completedtodos,
          userName,
          csrfToken: request.csrfToken(),
        });
      } else {
        response.json({
          overduetodos,
          duetodaytodos,
          duelatertodos,
          completedtodos,
        });
      }
    } catch (error) {
      console.log(error);
      return response.status(422).json(error);
    }
  }
);
app.get(
  "/todos/:id",
  connectEnsureLogin.ensureLoggedIn(),
  async function (request, response) {
    try {
      const todo = await Todo.findByPk(request.params.id);
      return response.json(todo);
    } catch (error) {
      console.log(error);
      return response.status(422).json(error);
    }
  }
);
app.post(
  "/todos",
  connectEnsureLogin.ensureLoggedIn(),
  async function (request, response) {
    if (request.body.title.length < 5) {
      request.flash("error", "Length of the TO-DO Should be a minimum of length 5");
      return response.redirect("/todos");
    }
    let dueDateError = request.body.dueDate;
    if (dueDateError == false) {
      request.flash("error", "Please choose any date");
      return response.redirect("/todos");
    }
    try {
      await Todo.addTodo({
        title: request.body.title,
        dueDate: request.body.dueDate,
        userId: request.user.id,
      });
      request.flash("success", "Todo Added Succesfully");
      return response.redirect("/todos");
    } catch (error) {
      console.log(error);
      return response.status(422).json(error);
    }
  }
);
app.put(
  "/todos/:id",
  connectEnsureLogin.ensureLoggedIn(),
  async function (request, response) {
    try {
      await Todo.findByPk(request.params.id);
      const todo = await Todo.findByPk(request.params.id);
      const updatedTodo = await todo.setCompletionStatus(
        request.body.completed
      );
      return response.json(updatedTodo);
    } catch (error) {
      console.log(error);
      return response.status(422).json(error);
    }
  }
);
app.post("/users", async (request, response) => {
  // console.log("First Name", request.body.firstName);
  if (request.body.firstName == false) {
    request.flash("error", "Please Enter Your First Name");
    return response.redirect("/signup");
  }
  if (request.body.lastName == false) {
    request.flash("error", "Please Enter Your Last Name");
    return response.redirect("/signup");
  }
  if (request.body.password == false) {
    request.flash("error", "Please Enter a Password");
    return response.redirect("/signup");
  }
  if (request.body.password.length < 8) {
    request.flash("error","Password length should be a minimum of 8 characters!");
    return response.redirect("/signup");
  }
  const Pwd = await bcrypt.hash(request.body.password, saltRounds);
  console.log(Pwd);
  try {
    const user = await User.create({
      firstName: request.body.firstName,
      lastName: request.body.lastName,
      email: request.body.email,
      password: Pwd,
    });
    request.login(user, (err) => {
      if (err) {
        console.log(err);
        response.redirect("/");
      } else {
        response.redirect("/todos");
      }
    });
  } 
  catch (error) {
    request.flash("error", error.message);
    return response.redirect("/signup");
  }
});
app.get("/", async (request, response) => {
  if (request.user) {
    return response.redirect("/todos");
  } else {
    response.render("index", {
      title: "ToDo-Application",
      csrfToken: request.csrfToken(),
    });
  }
});
app.get("/home", async (request, response) => {
  return response.render("index", {
    title: "ToDo-Application",
    csrfToken: request.csrfToken(),
  });
});
app.get("/login", (request, response) => {
  response.render("login", { title: "Login", csrfToken: request.csrfToken() });
});
app.get("/signup", (request, response) => {
  response.render("signup", {
    title: "Sign Up",
    csrfToken: request.csrfToken(),
  });
});
app.get("/signout", (request, response, next) => {
  request.logout((err) => {
    if (err) {
      return next(err);
    }
    response.redirect("/");
  });
});
app.post(
  "/session",
  passport.authenticate("local", {
    failureRedirect: "/login",
    failureFlash: true,
  }),
  (request, response) => {
    console.log(request.user);
    response.redirect("/todos");
  }
);

app.delete("/todos/:id", async function (request, response) {
  console.log("We have to delete a Todo with ID: ", request.params.id);
  try {
    const loggedInUserId = request.user.id;
    const result = await Todo.remove(request.params.id, loggedInUserId);
    return response.json({ success: result == 1 });
  } catch (error) {
    return response.status(422).json(error);
  }
});

module.exports = app;