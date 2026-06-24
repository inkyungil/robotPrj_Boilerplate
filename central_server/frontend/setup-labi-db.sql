CREATE DATABASE IF NOT EXISTS labi
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

CREATE USER IF NOT EXISTS 'labi_user'@'localhost'
  IDENTIFIED BY '106a1752c19b1f58429b7a6c131dfedb';

GRANT ALL PRIVILEGES ON labi.* TO 'labi_user'@'localhost';
FLUSH PRIVILEGES;

USE labi;

CREATE TABLE IF NOT EXISTS conversations (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  session_id VARCHAR(128) NOT NULL,
  title VARCHAR(255) NULL,
  model_name VARCHAR(128) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_conversations_session_id (session_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS messages (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  conversation_id BIGINT UNSIGNED NOT NULL,
  role ENUM('user', 'assistant', 'system') NOT NULL,
  content TEXT NOT NULL,
  model_name VARCHAR(128) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_messages_conversation_created (conversation_id, created_at),
  CONSTRAINT fk_messages_conversation
    FOREIGN KEY (conversation_id) REFERENCES conversations(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ai_model_settings (
  id TINYINT UNSIGNED NOT NULL DEFAULT 1,
  selected_model VARCHAR(128) NOT NULL DEFAULT 'qwen3:1.7b',
  ollama_url VARCHAR(255) NOT NULL DEFAULT 'http://127.0.0.1:11434',
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT chk_ai_model_settings_singleton CHECK (id = 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO ai_model_settings (id, selected_model, ollama_url)
VALUES (1, 'qwen3:1.7b', 'http://127.0.0.1:11434')
ON DUPLICATE KEY UPDATE
  selected_model = VALUES(selected_model),
  ollama_url = VALUES(ollama_url);
