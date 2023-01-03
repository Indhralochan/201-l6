const request = require("supertest");
var cheerio = require("cheerio");
jest.setTimeout(10000);

const db = require("../models/index");
const app = require("../app");

let server, agent;
function getCsrfToken(res) {
  var $ = cheerio.load(res.text);
  return $("[name=_csrf]").val();
}
const login = async (agent, username, password) => {
  let res = await agent.get("/login");
  let token = getCsrfToken(res);
  res = await agent.post("/session").send({
    email: username,
    password: password,
    _csrf: token,
  });
};

describe("My Todo Application", function () {
  beforeAll(async () => {
    await db.sequelize.sync({ force: true });
    server = app.listen(4000, () => {});
    agent = request.agent(server);
  });

  afterAll(async () => {
    try {
      await db.sequelize.close();
      await server.close();
    } catch (error) {
      console.log(error);
    }
  });
  test("Sign up test", async () => {
    let res = await agent.get("/signup");
    const token = getCsrfToken(res);
    res = await agent.post("/users").send({
      firstName: "Test",
      lastName: "User 1",
      email: "user1@test.com",
      password: "password",
      _csrf: token,
    });
    expect(res.statusCode).toBe(302);
  });
  test("Sign Out test", async () => {
    let res = await agent.get("/todos");
    expect(res.statusCode).toBe(200);
    res = await agent.get("/signout");
    expect(res.statusCode).toBe(302);
    res = await agent.get("/todos");
    expect(res.statusCode).toBe(302);
  });
  test("user's should only be able to update their own changes", async () => {
    let result = await agent.get("/signup");
    let token = getCsrfToken(result);
    result = await agent.post("/users").send({
      firstName: "Test",
      lastName: "User 1",
      email: "user1@test.com",
      password: "password",
      _csrf: token,
    });
    result = await agent.get("/todos");
    token = getCsrfToken(result);
    result = await agent.post("/todos").send({
      title: "watch naruto",
      dueDate: new Date().toISOString(),
      completed: false,
      _csrf: token,
    });
    const firstUserId = result.id;
    //logout the above user
    await agent.get("/signout");
    //create another user account
    result = await agent.get("/signup");
    token = getCsrfToken(result);
    result = await agent.post("/users").send({
      firstName: "Test1",
      lastName: "User 2",
      email: "user2@test.com",
      password: "Password",
      _csrf: token,
    });
    result = await agent.get("/todos");
    token = getCsrfToken(result);
    const RespMark = await agent.put(`/todos/${firstUserId}`).send({
      _csrf: token,
      completed: true,
    });
    expect(RespMark.statusCode).toBe(422);
    //Try marking incomplete
    result = await agent.get("/todos");
    token = getCsrfToken(result);
    const markIncpResp = await agent
      .put(`/todos/${firstUserId}`)
      .send({
        _csrf: token,
        completed: false,
      });
    expect(markIncpResp.statusCode).toBe(422);
  });
  test("Creates a todo and responds with json at /todos POST endpoint", async () => {
    const agent = request.agent(server);
    await login(agent, "user1@test.com", "password");
    const res = await agent.get("/todos");
    const token = getCsrfToken(res);
    const response = await agent.post("/todos").send({
      title: "watch kimi no nawa",
      dueDate: new Date().toISOString(),
      completed: false,
      _csrf: token,
    });
    expect(response.statusCode).toBe(302);
  });
  test("Marks a todo with the given ID as complete", async () => {
    const agent = request.agent(server);
    await login(agent, "user1@test.com", "password");
    let res = await agent.get("/todos");
    let token = getCsrfToken(res);
    await agent.post("/todos").send({
      title: "watch demon slayer",
      dueDate: new Date().toISOString(),
      completed: false,
      _csrf: token,
    });
    const grpdResp = await agent
      .get("/todos")
      .set("Accept", "application/json");
    const prsdGrpResp = JSON.parse(grpdResp.text);
    const dueTodayCount = prsdGrpResp.duetodaytodos.length;
    const latestTodo = prsdGrpResp.duetodaytodos[dueTodayCount - 1];
    res = await agent.get("/todos");
    token = getCsrfToken(res);
    const RespMark = await agent
      .put(`/todos/${latestTodo.id}`)
      .send({
        _csrf: token,
        completed: true,
      });
    const prsdUpdResp = JSON.parse(RespMark.text);
    expect(prsdUpdResp.completed).toBe(true);
  });
  test("One user shouldn't be able delete other's todos", async () => {
    const agent = request.agent(server);
    let result = await agent.get("/signup");
    let token = getCsrfToken(result);
    result = await agent.post("/users").send({
      firstName: "Test",
      lastName: "User 1",
      email: "user1@test.com",
      password: "password",
      _csrf: token,
    });
    result = await agent.get("/todos");
    token = getCsrfToken(result);
    result = await agent.post("/todos").send({
      title: "watch dragonball z",
      dueDate: new Date().toISOString(),
      completed: false,
      _csrf: token,
    });
    const firstUserId = result.id;
    await agent.get("/signout");
    result = await agent.get("/signup");
    token = getCsrfToken(result);
    result = await agent.post("/users").send({
      firstName: "Test1",
      lastName: "User 2",
      email: "user2@test.com",
      password: "Password",
      _csrf: token,
    });
    //create todo
    result = await agent.get("/todos");
    token = getCsrfToken(result);
    result = await agent.post("/todos").send({
      title: "watch Bleach",
      dueDate: new Date().toISOString(),
      completed: false,
      _csrf: token,
    });
    const secondUserid = result.id;
    result = await agent.get("/todos");
    token = getCsrfToken(result);
    let deleteTodoResponse = await agent.delete(`/todos/${firstUserId}`).send({
      _csrf: token,
    });
    expect(deleteTodoResponse.statusCode).toBe(422);
    await login(agent, "user1@test.com", "password");
    result = await agent.get("/todos");
    token = getCsrfToken(result);
    deleteTodoResponse = await agent.delete(`/todos/${secondUserid}`).send({
      _csrf: token,
    });
    expect(deleteTodoResponse.statusCode).toBe(422);
  }, 30000);
  test("Marks a todo with the given ID as Incomplete", async () => {
    const agent = request.agent(server);
    await login(agent, "user1@test.com", "password");
    let res = await agent.get("/todos");
    let token = getCsrfToken(res);
    await agent.post("/todos").send({
      title: "watch hunter x hunter",
      dueDate: new Date().toISOString(),
      completed: false,
      _csrf: token,
    });
    const grpdResp = await agent
      .get("/todos")
      .set("Accept", "application/json");
    const prsdGrpResp = JSON.parse(grpdResp.text);
    const dueTodayCount = prsdGrpResp.duetodaytodos.length;
    const latestTodo = prsdGrpResp.duetodaytodos[dueTodayCount - 1];
    res = await agent.get("/todos");
    token = getCsrfToken(res);

    const RespMark = await agent
      .put(`/todos/${latestTodo.id}`)
      .send({
        _csrf: token,
        completed: true,
      });
    const prsdUpdResp = JSON.parse(RespMark.text);
    expect(prsdUpdResp.completed).toBe(true);

    res = await agent.get("/todos");
    token = getCsrfToken(res);

    const markIncpResp = await agent
      .put(`/todos/${latestTodo.id}`)
      .send({
        _csrf: token,
        completed: false,
      });
    const prsdUpdResp2 = JSON.parse(markIncpResp.text);
    expect(prsdUpdResp2.completed).toBe(false);
  });

  test("Deletes a todo with the given ID if it exists", async () => {
    const agent = request.agent(server);
    await login(agent, "user1@test.com", "password");
    let res = await agent.get("/todos");
    let token = getCsrfToken(res);
    await agent.post("/todos").send({
      title: "Watch My hero academia",
      dueDate: new Date().toISOString(),
      completed: false,
      _csrf: token,
    });
    const grpdResp = await agent
      .get("/todos")
      .set("Accept", "application/json");
    const prsdGrpResp = JSON.parse(grpdResp.text);
    const dueTodayCount = prsdGrpResp.duetodaytodos.length;
    const latestTodo = prsdGrpResp.duetodaytodos[dueTodayCount - 1];
    res = await agent.get("/todos");
    token = getCsrfToken(res);
    const todoid = latestTodo.id;
    const deleteResponseTrue = await agent.delete(`/todos/${todoid}`).send({
      _csrf: token,
    });
    const prsdDelRespTrue = JSON.parse(
      deleteResponseTrue.text
    ).success;
    expect(prsdDelRespTrue).toBe(true);
    res = await agent.get("/todos");
    token = getCsrfToken(res);
    const deleteResponseFail = await agent.delete(`/todos/${todoid}`).send({
      _csrf: token,
    });
    const parsedDeleteResponseFail = JSON.parse(
      deleteResponseFail.text
    ).success;
    expect(parsedDeleteResponseFail).toBe(false);
  });
});