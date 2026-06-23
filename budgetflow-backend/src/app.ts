import cors from 'cors';
import express = require('express');
import * as dotenv from 'dotenv';
import * as path from 'path';
import YAML = require('yamljs');
import swaggerUi from 'swagger-ui-express';
import { authRouter }     from './modules/auth/auth.router';
import { projectRouter }  from './modules/project/project.router';
import { expenseRouter }  from './modules/expense/expense.router';
import { categoryRouter } from './modules/category/category.router';
import { templateRouter } from './modules/template/template.router';
import { exportRouter }   from './modules/export/export.router';
import { taxRouter }      from './modules/tax/tax.router';
import { authenticateJWT } from './middlewares/auth.middleware';

dotenv.config();
const app = express();

app.use(cors({ origin: ['http://localhost:3000', 'http://localhost:3001'], credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

try {
  const swaggerDocument = YAML.load(path.join(process.cwd(), 'swagger.yaml'));
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
  console.log('Swagger UI: http://localhost:3000/api-docs');
} catch {
  console.error('swagger.yaml 로드 실패');
}

app.use('/api/auth', authRouter);
app.use('/api/projects', authenticateJWT, projectRouter);
// 예산 카테고리는 프론트엔드가 /api/budget-categories 로 호출한다.
// (이전에는 /api/projects 에 마운트되어 projectRouter 의 GET '/' 에 가려져 도달 불가했다.)
app.use('/api/budget-categories', authenticateJWT, categoryRouter);
app.use('/api/projects', authenticateJWT, templateRouter);
app.use('/api/projects', authenticateJWT, exportRouter);
app.use('/api/projects/:projectId/tax', authenticateJWT, taxRouter);

// 봇 전용 엔드포인트 — POST /는 Slack 봇이 직접 호출하므로 인증 없음. GET/PATCH는 라우터 내부에서 authenticateJWT 적용.
app.use('/api/expenses', expenseRouter);

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal Server Error', message: err.message });
});

export default app;
