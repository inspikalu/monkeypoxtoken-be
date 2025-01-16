import express, { Application } from "express";
import indexRoutes from "./routes/index";
import "dotenv/config";
import cors, { CorsOptions } from "cors";
import { errorHandler } from "./middlewares/errorHandler";

const app: Application = express();
const port: number = 3000;

// Middleware to parse JSON bodies
app.use(express.json());
const corsOptions: CorsOptions = {
  origin: "http://localhost:3001",
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type", "Authorization"],
};
app.use(cors(corsOptions));

// Use routes
app.use("/api/", indexRoutes);
app.use(errorHandler);

// Start the server
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
