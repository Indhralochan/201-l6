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
  let csrfToken = getCsrfToken(res);
  res = await agent.post("/session").send({
    email: username,
    password: password,
    _csrf: csrfToken,
  });
};

describe("Todo Application", function () {
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
  test("Sign up", async () => {
    let res = await agent.get("/signup");
    const csrfToken = getCsrfToken(res);
    res = await agent.post("/users").send({
      firstName: "indhra",
      lastName: "lochan",
      email: "indra.lochans@gmail.com",
      password: "I@123456n",
      _csrf: csrfToken,
    });
    expect(res.statusCode).toBe(302);
  });
});