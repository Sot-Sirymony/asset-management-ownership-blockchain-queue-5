CREATE TABLE IF NOT EXISTS department (
    dep_id SERIAL PRIMARY KEY,
    dep_name VARCHAR(100) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
    user_id SERIAL PRIMARY KEY,
    dep_id INT REFERENCES department(dep_id) ON DELETE SET NULL,
    username VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    certificate TEXT,
    dob DATE,
    gender CHAR(6),
    email VARCHAR(100),
    phone_number VARCHAR(15),
    profile_img TEXT,
    address TEXT,
    place_of_birth VARCHAR(255),
    full_name VARCHAR(100),
    role VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    description TEXT
);

CREATE TABLE IF NOT EXISTS asset_request (
    request_id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(user_id) ON DELETE SET NULL,
    asset_name VARCHAR(255) NOT NULL,
    reason TEXT,
    qty INT,
    unit VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    attachment TEXT,
    status VARCHAR(20) DEFAULT 'PENDING',
    assigned_asset_id VARCHAR(255),
    resolved_at TIMESTAMP
);
