import dotenv from "dotenv";
dotenv.config({ path: ".env.test" });

import request from "supertest";
import mongoose from "mongoose";
import app from "../src/app.js";

beforeAll(async () => {
  await mongoose.connect(process.env.MONGO_URI);
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

afterEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
});

describe("POST /api/auth/register", () => {
  it("should register a new user", async () => {
    const res = await request(app).post("/api/auth/register").send({
      name: "Kingsley",
      email: "kingsley@example.com",
      password: "password123",
    });
    expect(res.statusCode).toBe(201);
    expect(res.body).toHaveProperty("token");
    expect(res.body).not.toHaveProperty("password");
  });

  it("should not register duplicate email", async () => {
    await request(app).post("/api/auth/register").send({
      name: "Kingsley",
      email: "kingsley@example.com",
      password: "password123",
    });
    const res = await request(app).post("/api/auth/register").send({
      name: "Kingsley",
      email: "kingsley@example.com",
      password: "password123",
    });
    expect(res.statusCode).toBe(400);
  });
});

describe("POST /api/auth/login", () => {
  beforeEach(async () => {
    await request(app).post("/api/auth/register").send({
      name: "Kingsley",
      email: "kingsley@example.com",
      password: "password123",
    });
  });

  it("should login with valid credentials", async () => {
    const res = await request(app).post("/api/auth/login").send({
      email: "kingsley@example.com",
      password: "password123",
    });
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty("token");
  });

  it("should reject invalid credentials", async () => {
    const res = await request(app).post("/api/auth/login").send({
      email: "kingsley@example.com",
      password: "wrongpassword",
    });
    expect(res.statusCode).toBe(401);
  });
});

describe("Task Routes", () => {
  let token;
  let token2;

  beforeEach(async () => {
    const res1 = await request(app).post("/api/auth/register").send({
      name: "User One",
      email: "user1@example.com",
      password: "password123",
    });
    token = res1.body.token;

    const res2 = await request(app).post("/api/auth/register").send({
      name: "User Two",
      email: "user2@example.com",
      password: "password123",
    });
    token2 = res2.body.token;
  });

  it("should create a task", async () => {
    const res = await request(app)
      .post("/api/tasks")
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Test Task" });
    expect(res.statusCode).toBe(201);
    expect(res.body).toHaveProperty("title", "Test Task");
  });

  it("should not create task without token", async () => {
    const res = await request(app).post("/api/tasks").send({ title: "Test Task" });
    expect(res.statusCode).toBe(401);
  });

  it("should get only own tasks", async () => {
    await request(app)
      .post("/api/tasks")
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Task A" });
    await request(app)
      .post("/api/tasks")
      .set("Authorization", `Bearer ${token2}`)
      .send({ title: "Task B" });
    const res = await request(app)
      .get("/api/tasks")
      .set("Authorization", `Bearer ${token}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.length).toBe(1);
    expect(res.body[0].title).toBe("Task A");
  });

  it("should delete own task", async () => {
    const create = await request(app)
      .post("/api/tasks")
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Delete Me" });
    const res = await request(app)
      .delete(`/api/tasks/${create.body._id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.statusCode).toBe(200);
  });

  it("should not delete another user task", async () => {
    const create = await request(app)
      .post("/api/tasks")
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Protected Task" });
    const res = await request(app)
      .delete(`/api/tasks/${create.body._id}`)
      .set("Authorization", `Bearer ${token2}`);
    expect(res.statusCode).toBe(403);
  });
});
