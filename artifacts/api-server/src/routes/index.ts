import { Router, type IRouter } from "express";
import healthRouter from "./health";
import presenceRouter from "./presence";
import adminRouter from "./admin";

const router: IRouter = Router();

router.use(healthRouter);
router.use(presenceRouter);
router.use(adminRouter);

export default router;
