const http = require('http');
const express = require('express');
const app = express();
const mysql = require('mysql2');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require("path");
const bcrypt = require('bcrypt');

const hostname = '127.0.0.1';
const port = 3000;

const connection = mysql.createConnection({
    host: process.env.TIDB_HOST || "gateway01.ap-southeast-1.prod.aws.tidbcloud.com",
    user: process.env.TIDB_USER || "3Rou3tmmf67hLmN.root",
    password: process.env.TIDB_PASSWORD || "OIrD1LvK4AGIG6T6",
    database: process.env.TIDB_DATABASE || "test",
    port: process.env.TIDB_PORT || 4000,
    ssl: { ca: process.env.TIDB_CA_CERT }
});

connection.connect(error => {
    if (error) {
        console.error('Database connection failed:', error);
    } else {
        console.log('Connected to TiDB Cloud');
    }
});


app.use(cors());
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: false }));

app.listen(port, hostname, () => {
    console.log(`Server running at http://${hostname}:${port}/`);
});


app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "user.html"));
});

app.get('/getUsers', (req, res) => {
    connection.query('SELECT user_id, fullname_user, email, role, status FROM users', (err, results) => {
        if (err) {
            console.error("Database error:", err);
            return res.status(500).json({ error: true, msg: err.message });
        }
        res.json({ error: false, data: results });
    });
});

app.get('/getUser/:id', (req, res) => {
    connection.query('SELECT * FROM users WHERE user_id = ?', [req.params.id], (err, results) => {
        if (err) return res.status(500).json({ error: true, msg: err.message });
        res.json({ error: false, data: results.length ? results[0] : null });
    });
});

app.post('/addUser', async (req, res) => {
    const { user_id, fullname_user, email, password, role, chronic_disease, status, patient_id } = req.body;

    console.log("📥 ข้อมูลที่ได้รับจาก Frontend:", req.body);

    if (!user_id || !fullname_user || !email || !password || !role) {
        console.error("❌ ข้อมูลไม่ครบ:", req.body);
        return res.status(400).json({ error: true, msg: "❌ กรุณากรอกข้อมูลให้ครบถ้วน" });
    }

    try {
        const checkEmailQuery = "SELECT email FROM users WHERE email = ?";
        connection.query(checkEmailQuery, [email], async (err, results) => {
            if (err) {
                console.error("❌ ตรวจสอบอีเมลล้มเหลว:", err);
                return res.status(500).json({ error: true, msg: "❌ Database error" });
            }
            if (results.length > 0) {
                return res.status(400).json({ error: true, msg: "❌ อีเมลนี้ถูกใช้แล้ว" });
            }

            const hashedPassword = await bcrypt.hash(password, 10);

            const patient_id_value = patient_id ? patient_id : null; 

const sql = `INSERT INTO users (user_id, fullname_user, email, password, role, chronic_disease, status, patient_id, created_at, updated_at) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`;

const values = [user_id, fullname_user, email, hashedPassword, role, chronic_disease || "", status || "active", patient_id_value];

connection.query(sql, values, (err, results) => {
    if (err) {
        console.error("Error inserting user:", err);
        return res.status(500).json({ error: true, msg: "Cannot Insert", details: err.sqlMessage });
    }
    console.log("เพิ่มผู้ใช้สำเร็จ:", results);
    res.json({ error: false, data: results, msg: "Inserted successfully" });
});

        });

    } catch (error) {
        console.error("❌ Error:", error);
        return res.status(500).json({ error: true, msg: "❌ ระบบเกิดข้อผิดพลาด" });
    }
});


app.put('/editUser/:id', (req, res) => {
    const { fullname_user, email, password, role, chronic_disease, status, patient_id } = req.body;
    const user_id = req.params.id;

    const sql = 'UPDATE users SET fullname_user = ?, email = ?, password = ?, role = ?, chronic_disease = ?, status = ?, patient_id = ? WHERE user_id = ?';
    const values = [fullname_user, email, password, role, chronic_disease, status, patient_id, user_id];

    connection.query(sql, values, (err, results) => {
        if (err) return res.status(500).json({ error: true, msg: err.message });
        res.json({ error: false, msg: results.affectedRows ? "User Updated" : "User Not Found" });
    });
});

app.delete('/deleteUser/:id', (req, res) => {
    const userId = req.params.id;
    connection.query('DELETE FROM users WHERE user_id = ?', [userId], (err, results) => {
        if (err) return res.status(500).json({ error: true, msg: err.message });
        res.json({ error: false, message: "User deleted successfully" });
    });
});

app.get('/getPatients', (req, res) => {
    connection.query('SELECT patient_id, first_name, last_name FROM patients', (err, results) => {
        if (err) {
            console.error("Database error:", err);
            return res.status(500).json({ error: true, msg: "Database error", details: err.message });
        }
        res.json({ error: false, data: results });
    });
});

app.get('/getPatient/:id', (req, res) => {
    connection.query('SELECT patient_id, first_name, last_name FROM patients WHERE patient_id = ?', [req.params.id], (err, results) => {
        if (err) {
            console.error("Database error:", err);
            return res.status(500).json({ error: true, msg: "Database error", details: err.message });
        }
        res.json({ error: false, data: results.length ? results[0] : null });
    });
});

app.post('/addAppointment', (req, res) => {
    const { patient_id, user_id, appointment_date, clinic } = req.body;

    if (!patient_id || !user_id || !appointment_date || !clinic) {
        return res.status(400).json({ error: true, msg: "กรุณากรอกข้อมูลให้ครบถ้วน" });
    }

    const sql = `INSERT INTO appointments (patient_id, user_id, appointment_date, clinic, created_at) 
                 VALUES (?, ?, ?, ?, NOW())`;

    connection.query(sql, [patient_id, user_id, appointment_date, clinic], (err, results) => {
        if (err) {
            console.error("Database Insert Error:", err);
            return res.status(500).json({ error: true, msg: "ไม่สามารถเพิ่มนัดหมายได้", details: err.sqlMessage });
        }
        res.json({ error: false, msg: "เพิ่มนัดหมายสำเร็จ!", data: results });
    });
});

app.get('/getAppointments', (req, res) => {
    connection.query('SELECT * FROM appointments ORDER BY appointment_date DESC', (err, results) => {
        if (err) {
            console.error("Database error:", err);
            return res.status(500).json({ error: true, msg: "Database error", details: err.message });
        }
        res.json({ error: false, data: results });
    });
});



app.put('/editAppointment/:appointmentId', (req, res) => {
    let { appointment_date, clinic } = req.body;
    connection.query('UPDATE appointments SET appointment_date = ?, clinic = ? WHERE appointment_id = ?', 
    [appointment_date, clinic, req.params.appointmentId], (err, results) => {
        res.json(err ? { error: "Cannot update", details: err } : { message: "Appointment updated", data: results });
    });
});

app.delete('/deleteAppointment/:appointmentId', (req, res) => {
    connection.query('DELETE FROM appointments WHERE appointment_id = ?', [req.params.appointmentId], (err, results) => {
        res.json(err ? { error: "Cannot delete", details: err } : { message: "Appointment deleted", data: results });
    });
});