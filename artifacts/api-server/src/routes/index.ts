import { Router, type IRouter } from "express";
import healthRouter from "./health";
import presenceRouter from "./presence";
import adminRouter from "./admin";
import xanaxRouter from "./xanax";
import guidesRouter from "./guides";

const router: IRouter = Router();

router.use(healthRouter);
router.use(presenceRouter);
router.use(adminRouter);
router.use(xanaxRouter);
router.use(guidesRouter);

export default router;
