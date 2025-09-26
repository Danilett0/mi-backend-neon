-- setup.sql
-- Script para crear una tabla de ejemplo en tu base de datos Neon

-- Crear tabla de usuarios de ejemplo
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insertar algunos datos de ejemplo
INSERT INTO users (name, email) VALUES 
    ('Juan Pérez', 'juan@ejemplo.com'),
    ('María García', 'maria@ejemplo.com'),
    ('Carlos López', 'carlos@ejemplo.com')
ON CONFLICT (email) DO NOTHING;

-- Crear índice para mejorar rendimiento
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Verificar que se creó correctamente
SELECT 'Tabla users creada exitosamente' as mensaje;
SELECT COUNT(*) as total_usuarios FROM users;