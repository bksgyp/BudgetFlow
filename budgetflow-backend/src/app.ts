import cors from 'cors';
import express = require('express');  
import * as dotenv from 'dotenv';
import * as path from 'path';
import YAML = require('yamljs');       
import swaggerUi from 'swagger-ui-express'; 

import { authRouter } from './modules/auth/auth.router';
import { projectRouter } from './modules/project/project.router';
import { expenseRouter } from './modules/expense/expense.router';
import { categoryRouter } from './modules/category/category.router';
import { templateRouter } from './modules/template/template.router';
import { exportRouter } from './modules/export/export.router';
import { authenticateJWT } from './middlewares/auth.middleware';

// dotenv 초기화
dotenv.config();

const app = express(); 

app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3001'],
  credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 루트 경로에 위치할 swagger.yaml 파일을 읽어와 /api-docs로 노출합니다.
try {
  const swaggerDocument = YAML.load(path.join(process.cwd(), 'swagger.yaml'));
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
  console.log('📌 Swagger UI가 http://localhost:3000/api-docs 에 등록되었습니다.');
} catch (e) {
  console.error('⚠️ swagger.yaml 파일을 로드하지 못했습니다. 명세서 화면이 열리지 않습니다.');
}

// 15개 전체 API 세부 라우터 등록
app.use('/api/auth', authRouter);
app.use('/api/projects', authenticateJWT, projectRouter);
// 봇 전용 엔드포인트 — POST /는 Slack 봇이 직접 호출하므로 인증 없음. GET/PATCH는 라우터 내부에서 authenticateJWT 적용.
app.use('/api/expenses', expenseRouter);
app.use('/api/budget-categories', authenticateJWT, categoryRouter);
app.use('/api/projects', authenticateJWT, templateRouter);
app.use('/api/projects', authenticateJWT, exportRouter);

// 공통 서버 상태 에러 핸들러 미들웨어
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal Server Error', message: err.message });
});

export default app;