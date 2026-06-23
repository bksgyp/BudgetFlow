-- 1. 고유한 문자열 ID 생성을 위한 익스텐션 (필요시 사용, 여기서는 UUID 대신 문자열 매핑)
-- 상태값들을 안전하게 제한하기 위한 CHECK 제약조건용 ENUM 대체 규칙 설정

-- 2. Project 테이블 생성
CREATE TABLE projects (
    id VARCHAR(50) PRIMARY KEY,
    organization_id VARCHAR(50) NOT NULL,
    name VARCHAR(100) NOT NULL,
    total_budget INT NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed')),
    slack_channel_id VARCHAR(50) NOT NULL,
    slack_channel_name VARCHAR(100) NOT NULL,
    template_file_name VARCHAR(255),
    template_mapping_status VARCHAR(20) NOT NULL DEFAULT 'none' CHECK (template_mapping_status IN ('none', 'suggested', 'confirmed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    closed_at TIMESTAMP WITH TIME ZONE
);

-- 3. BudgetCategory 테이블 생성
CREATE TABLE budget_categories (
    id VARCHAR(50) PRIMARY KEY,
    project_id VARCHAR(50) NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(50) NOT NULL,
    budget_limit INT NOT NULL DEFAULT 0,
    keywords TEXT[] NOT NULL DEFAULT '{}', -- PostgreSQL의 문자열 배열 타입 활용
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Expense 테이블 생성
CREATE TABLE expenses (
    id VARCHAR(50) PRIMARY KEY,
    project_id VARCHAR(50) NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    category_id VARCHAR(50) REFERENCES budget_categories(id) ON DELETE SET NULL,
    date DATE NOT NULL,
    amount INT NOT NULL,
    merchant VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    payer_name VARCHAR(50) NOT NULL,
    input_channel VARCHAR(20) NOT NULL DEFAULT 'slack' CHECK (input_channel IN ('slack')),
    slack_user_id VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'created' CHECK (status IN ('created', 'processing', 'needs_review', 'approved', 'rejected', 'exported')),
    evidence_status VARCHAR(20) NOT NULL DEFAULT 'none' CHECK (evidence_status IN ('none', 'uploaded', 'ocr_completed', 'ocr_failed', 'verified')),
    evidence_file_id VARCHAR(50),
    ai_confidence NUMERIC(3, 2) NOT NULL DEFAULT 0.0, -- 소수점 2자리까지 신뢰도 표현
    missing_fields TEXT[] NOT NULL DEFAULT '{}',
    review_reason TEXT,
    items JSONB NOT NULL DEFAULT '[]'::jsonb, -- 상세 품목/수량/단가 (LLM 추출)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. ExportJob 테이블 생성
CREATE TABLE export_jobs (
    id VARCHAR(50) PRIMARY KEY,
    project_id VARCHAR(50) NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL CHECK (type IN ('budget_plan', 'expense_report')),
    status VARCHAR(20) NOT NULL DEFAULT 'requested' CHECK (status IN ('requested', 'generating', 'completed', 'failed', 'expired')),
    included_expense_count INT NOT NULL DEFAULT 0,
    excluded_review_count INT NOT NULL DEFAULT 0,
    download_url TEXT,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. EvidenceFile 테이블 생성
CREATE TABLE evidence_files (
    id VARCHAR(50) PRIMARY KEY,
    project_id VARCHAR(50) NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    expense_id VARCHAR(50) NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    file_type VARCHAR(10) NOT NULL CHECK (file_type IN ('image', 'pdf', 'xlsx')),
    url TEXT NOT NULL,
    ocr_status VARCHAR(20) NOT NULL DEFAULT 'none',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 7. 성능 최적화를 위한 인덱스 미리 생성 (성급한 최적화가 아닌 필수 외래키 조회용)
CREATE INDEX idx_expenses_project_id ON expenses(project_id);
CREATE INDEX idx_budget_categories_project_id ON budget_categories(project_id);