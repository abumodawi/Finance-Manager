import { Router, type IRouter } from "express";
import healthRouter from "./health";
import accountsRouter from "./accounts";
import categoriesRouter from "./categories";
import salaryRouter from "./salary";
import loansRouter from "./loans";
import transactionsRouter from "./transactions";
import summaryRouter from "./summary";

const router: IRouter = Router();

router.use(healthRouter);
router.use(accountsRouter);
router.use(categoriesRouter);
router.use(salaryRouter);
router.use(loansRouter);
router.use(transactionsRouter);
router.use(summaryRouter);

export default router;
