// server.js
const express = require("express");
const { Pool } = require("pg");
const cors = require("cors");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Configuración de la conexión a PostgreSQL (Neon)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    require: true,
  },
});

app.get("/", (req, res) => {
  res.send("Hello! The server is running.");
});

// ======================
// RUTAS DE AUTENTICACIÓN
// ======================

// Ruta de login
app.post("/auth/login", async (req, res) => {
  const { username, password } = req.body;

  // Validar que se enviaron los datos
  if (!username || !password) {
    return res.status(400).json({
      success: false,
      message: "Usuario y contraseña son requeridos",
    });
  }

  try {
    // Buscar usuario en la base de datos
    const result = await pool.query(
      "SELECT id, username, password, name, email, is_active FROM users_login WHERE username = $1",
      [username]
    );

    // Verificar si el usuario existe
    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: "Usuario o contraseña incorrectos",
      });
    }

    const user = result.rows[0];

    // Verificar si el usuario está activo
    if (!user.is_active) {
      return res.status(401).json({
        success: false,
        message: "Usuario desactivado. Contacta al administrador",
      });
    }

    // Verificar contraseña (en texto plano por simplicidad)
    // NOTA: En producción usar bcrypt para comparar contraseñas encriptadas
    if (user.password !== password) {
      return res.status(401).json({
        success: false,
        message: "Usuario o contraseña incorrectos",
      });
    }

    // Actualizar último login
    await pool.query(
      "UPDATE users_login SET last_login = NOW() WHERE id = $1",
      [user.id]
    );

    // Login exitoso - devolver datos del usuario (sin contraseña)
    res.json({
      success: true,
      message: "Login exitoso",
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    console.error("Error en login:", error);
    res.status(500).json({
      success: false,
      message: "Error interno del servidor",
    });
  }
});

// Ruta para registrar nuevo usuario (opcional)
app.post("/auth/register", async (req, res) => {
  const { username, password, name, email } = req.body;

  // Validar datos requeridos
  if (!username || !password || !name) {
    return res.status(400).json({
      success: false,
      message: "Usuario, contraseña y nombre son requeridos",
    });
  }

  try {
    // Verificar si el usuario ya existe
    const existingUser = await pool.query(
      "SELECT username FROM users_login WHERE username = $1 OR email = $2",
      [username, email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: "El usuario o email ya existe",
      });
    }

    // Crear nuevo usuario
    const result = await pool.query(
      "INSERT INTO users_login (username, password, name, email) VALUES ($1, $2, $3, $4) RETURNING id, username, name, email",
      [username, password, name, email]
    );

    res.status(201).json({
      success: true,
      message: "Usuario registrado exitosamente",
      user: result.rows[0],
    });
  } catch (error) {
    console.error("Error registrando usuario:", error);
    res.status(500).json({
      success: false,
      message: "Error creando usuario",
    });
  }
});

// Ruta para obtener perfil de usuario (opcional)
app.get("/auth/profile/:username", async (req, res) => {
  const { username } = req.params;

  try {
    const result = await pool.query(
      "SELECT id, username, name, email, created_at, last_login FROM users_login WHERE username = $1 AND is_active = true",
      [username]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Usuario no encontrado",
      });
    }

    res.json({
      success: true,
      user: result.rows[0],
    });
  } catch (error) {
    console.error("Error obteniendo perfil:", error);
    res.status(500).json({
      success: false,
      message: "Error obteniendo perfil de usuario",
    });
  }
});


// Ruta para cambiar contraseña
app.put("/auth/change-password", async (req, res) => {
  const { userId, newPassword, currentPassword } = req.body;

  // Validar que se enviaron los datos requeridos
  if (!userId || !newPassword) {
    return res.status(400).json({
      success: false,
      message: "ID de usuario y nueva contraseña son requeridos",
    });
  }

  // Validar longitud mínima de contraseña
  if (newPassword.length < 6) {
    return res.status(400).json({
      success: false,
      message: "La nueva contraseña debe tener al menos 6 caracteres",
    });
  }

  try {
    // Verificar que el usuario existe y está activo
    const userResult = await pool.query(
      "SELECT id, username, password, is_active FROM users_login WHERE id = $1",
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Usuario no encontrado",
      });
    }

    const user = userResult.rows[0];

    // Verificar si el usuario está activo
    if (!user.is_active) {
      return res.status(401).json({
        success: false,
        message: "Usuario desactivado. Contacta al administrador",
      });
    }

    // Si se proporciona contraseña actual, verificarla (recomendado para seguridad)
    if (currentPassword && user.password !== currentPassword) {
      return res.status(401).json({
        success: false,
        message: "La contraseña actual no es correcta",
      });
    }

    // Actualizar la contraseña
    const updateResult = await pool.query(
      "UPDATE users_login SET password = $1, updated_at = NOW() WHERE id = $2 RETURNING username",
      [newPassword, userId]
    );

    // Verificar que se actualizó correctamente
    if (updateResult.rows.length === 0) {
      return res.status(500).json({
        success: false,
        message: "Error actualizando la contraseña",
      });
    }

    res.json({
      success: true,
      message: "Contraseña actualizada exitosamente",
      username: updateResult.rows[0].username,
    });

  } catch (error) {
    console.error("Error cambiando contraseña:", error);
    res.status(500).json({
      success: false,
      message: "Error interno del servidor",
    });
  }
});

// Ruta alternativa más simple (solo con userId y newPassword)
app.put("/auth/reset-password", async (req, res) => {
  const { userId, newPassword } = req.body;

  // Validar datos requeridos
  if (!userId || !newPassword) {
    return res.status(400).json({
      success: false,
      message: "ID de usuario y nueva contraseña son requeridos",
    });
  }

  // Validar longitud mínima de contraseña
  if (newPassword.length < 6) {
    return res.status(400).json({
      success: false,
      message: "La nueva contraseña debe tener al menos 6 caracteres",
    });
  }

  try {
    // Verificar que el usuario existe y actualizarlo directamente
    const result = await pool.query(
      "UPDATE users_login SET password = $1, updated_at = NOW() WHERE id = $2 AND is_active = true RETURNING id, username",
      [newPassword, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Usuario no encontrado o desactivado",
      });
    }

    res.json({
      success: true,
      message: "Contraseña restablecida exitosamente",
      user: {
        id: result.rows[0].id,
        username: result.rows[0].username,
      },
    });

  } catch (error) {
    console.error("Error restableciendo contraseña:", error);
    res.status(500).json({
      success: false,
      message: "Error interno del servidor",
    });
  }
});


// Manejo de errores global
app.use((error, req, res, next) => {
  console.error("Error no manejado:", error);
  res.status(500).json({
    success: false,
    message: "Error interno del servidor",
  });
});

// Manejo de rutas no encontradas
app.use("*", (req, res) => {
  res.status(404).json({
    success: false,
    message: "Ruta no encontrada",
  });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🚀 Servidor ejecutándose en puerto ${PORT}`);
  console.log(`📊 Dashboard disponible en: http://localhost:${PORT}`);
});

// Manejo de cierre graceful
process.on("SIGINT", async () => {
  console.log("\n🛑 Cerrando servidor...");
  await pool.end();
  process.exit(0);
});
