import { cpuTemperature, mem, networkStats } from "systeminformation";
import osu from "node-os-utils";

import express from "express";
import http from "http";
import { Server } from "socket.io";
import path from "path";

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const cpu_ = osu.cpu;

const toAsync = (func: any) => {
  return new Promise<any>((resolve) => {
    func((...dt: any[]) => {
      resolve(dt);
    });
  });
};

let datas = {
  "CPU::TEMP": -1,
  "CPU::USAGE": -1,
  "MEM::USAGE": -1,
  "NET::UP": -1,
  "NET::DOWN": -1,
};

app.get("/index.css", (req: any, res: any) => {
  res.sendFile(path.join(__dirname, "..", "index.css"));
});

app.get("/*", (req: any, res: any) => {
  res.sendFile(path.join(__dirname, "..", "index.html"));
});

io.on("connection", (socket) => {
  console.log("a user connected");
  socket.on("disconnect", () => {
    console.log("user disconnected");
  });

  Object.keys(datas).forEach((k) => {
    socket.emit(k, (datas as any)[k]);
  });
});

const sendCPU = async () => {
  let dt = ((await toAsync(cpuTemperature)) as any)[0]["main"];

  datas["CPU::TEMP"] = dt;
  io.emit("CPU::TEMP", dt);
};

const sendMem = async () => {
  let dt = ((await toAsync(mem)) as any)[0];
  let usage = (dt["active"] / dt["total"]) * 100;
  datas["MEM::USAGE"] = usage;
  io.emit("MEM::USAGE", usage);
};

const sendCPU_Usage = async () => {
  let dt = await cpu_.usage();
  datas["CPU::USAGE"] = dt;
  io.emit("CPU::USAGE", dt);
};

let lastRx = -1;
let lastTx = -1;

const sendNet = async () => {
  let dt = await networkStats();
  let nowRx = dt[0]["rx_bytes"];
  let nowTx = dt[0]["tx_bytes"];

  let diffRx = Math.round((nowRx - lastRx) / 1024);
  let diffTx = Math.round((nowTx - lastTx) / 1024);
  datas["NET::DOWN"] = diffRx;
  datas["NET::UP"] = diffTx;

  lastRx = nowRx;
  lastTx = nowTx;

  io.emit("NET::DOWN", diffRx);
  io.emit("NET::UP", diffTx);
};

const intervalMS = 500;
const netMS = 1000;

const getTime = async () => {
  try {
    await sendCPU();
    await sendMem();
    await sendCPU_Usage();
    setTimeout(getTime, intervalMS);
  } catch (e) {
    console.error(e);
    setTimeout(getTime, intervalMS);
  }
};

const getNetTime = async () => {
  try {
    await sendNet();
    setTimeout(getNetTime, netMS);
  } catch (e) {
    console.error(e);
    setTimeout(getNetTime, netMS);
  }
};

server.listen(20442, () => {
  console.log("listening on *:20442");
  getTime();
  getNetTime();
});
