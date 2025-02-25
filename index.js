const http = require('http');
const express = require('express');
const app = express();
const mysql = require('mysql2');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require("path");
const bcrypt = require('bcrypt');  // Declare bcrypt only once

const hostname = '127.0.0.1';
const port = 3000;
let cer_part = path.join(process.cwd(), 'isrgrootx1.pem');

const connection = mysql.createConnection({
    host: 'gateway01.ap-southeast-1.prod.aws.tidbcloud.com',
    user: '3Rou3tmmf67hLmN.root',
    password: '7cTo4rvU42PVip9o', // ใส่รหัสที่เพิ่งสร้าง
    database: 'test',
    port: 4000,
    ssl: { ca: fs.readFileSync('D:\\code\\miniP_bn-main\\isrgrootx1.pem') }  // เปลี่ยนเป็น path ที่ถูกต้อง
});

app.use(cors());
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: false }));

app.listen(port, hostname, () => {
    console.log(`Server running at http://${hostname}:${port}/`);
});
var urlencodedParser = bodyParser.urlencoded({ extended: false })

app.get('/', (req, res) => {
    res.json({
        "Name": "MedRights Manager API",
        "APIs": [
            { "api_name": "/getUsers/", "method": "get" },
            { "api_name": "/getUser/:id", "method": "get" },
            { "api_name": "/addUser/", "method": "post" },
            { "api_name": "/editUser/:id", "method": "put" },
            { "api_name": "/deleteUser/:id", "method": "delete" },
            { "api_name": "/getPatients/", "method": "get" },
            { "api_name": "/getPatient/:id", "method": "get" },
            { "api_name": "/getAppointments/:patientId", "method": "get" },
            { "api_name": "/addAppointment/", "method": "post" },
            { "api_name": "/editAppointment/:appointmentId", "method": "put" },
            { "api_name": "/deleteAppointment/:appointmentId", "method": "delete" }
        ]
    });
});

// Removed the duplicate 'bcrypt' declaration

const saltRounds = 10;

// ดึงข้อมูล Users ทั้งหมด
app.get('/getUsers', (req, res) => {
    connection.query('SELECT user_id, fullname_user, email, role, chronic_disease, status, patient_id, created_at, updated_at FROM users', (err, results) => {
        if (err) return res.status(500).json({ error: true, msg: err.message });
        res.json({ error: false, data: results });
    });
});

// ดึงข้อมูลผู้ใช้ตาม user_id
app.get('/getUser/:id', (req, res) => {
    connection.query('SELECT user_id, fullname_user, email, role, chronic_disease, status, patient_id, created_at, updated_at FROM users WHERE user_id = ?', [req.params.id], (err, results) => {
        if (err) return res.status(500).json({ error: true, msg: err.message });
        res.json({ error: false, data: results.length ? results[0] : null, msg: results.length ? "User found" : "User not found" });
    });
});

// เพิ่มผู้ใช้ใหม่ พร้อมแฮชรหัสผ่าน
app.post('/addUser', (req, res) => {
    const { user_id, fullname_user, email, password, role, status, chronic_disease, patient_id } = req.body;

    // ตรวจสอบว่ามีข้อมูลที่จำเป็นครบหรือไม่
    if (!user_id || !fullname_user || !email || !password || !role || !chronic_disease || !patient_id) {
        return res.json({ error: true, msg: "Missing required fields" });
    }

    // คำสั่ง SQL ที่มีการเพิ่ม patient_id เป็น FK
    const sql = `INSERT INTO users (user_id, fullname_user, email, password, role, chronic_disease, status, patient_id, created_at, updated_at) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`;

    const values = [user_id, fullname_user, email, password, role, chronic_disease, status || 'active', patient_id];

    connection.query(sql, values, (err, results) => {
        if (err) {
            console.error("Error inserting user:", err);
            return res.json({ error: true, msg: "Cannot Insert", details: err.code || err.sqlMessage });
        }
        if (results.affectedRows === 0) {
            return res.json({ error: true, msg: "No rows inserted" });
        }
        res.json({ error: false, data: results, msg: "Inserted successfully" });
    });
});



// แก้ไขข้อมูลผู้ใช้
app.put('/editUser/:id', (req, res) => {
    const { fullname_user, email, password, role, status, patient_id } = req.body;
    const user_id = req.params.id;

    const sql = 'UPDATE users SET fullname_user = ?, email = ?, password = ?, role = ?, chronic_disease = ?, status = ?, patient_id = ? WHERE user_id = ?';
    const values = [full_name, email, password, role, chronic_disease, status, patient_id, user_id];

    connection.query(sql, values, (err, results) => {
        if (err) {
            return res.status(500).json({ error: true, msg: err.message });
        }
        res.json({ error: false, msg: results.affectedRows ? "User Updated" : "User Not Found" });
    });
});
// ลบข้อมูล
app.delete('/deleteUser/:id', (req, res) => {
    const userId = req.params.id; // Get the ID from the URL parameter

    // 1. Database Query (Example using MySQL)
    const sql = 'DELETE FROM users WHERE user_id = ?'; 
    const values = [userId];

    connection.query(sql, values, (err, results) => {
        if (err) {
            console.error("Error deleting user:", err);  // Log the error!
            return res.status(500).json({ error: true, message: err.message });
        }

        if (results.affectedRows === 0) {
            return res.status(404).json({ error: false, message: "User not found" });
        }

        res.json({ error: false, message: "User deleted successfully" });
    });
});

// Patients API
// ดึงข้อมูลผู้ป่วยทั้งหมด
app.get('/getPatients', (req, res) => {
    const sql = `
        SELECT 
            patient_id,
            first_name,
            last_name,
            date_of_birth,
            gender,
            phone,
            email,
            address,
            created_at,
            updated_at
        FROM patients`;

    connection.query(sql, (err, results) => {
        if (err) {
            return res.status(500).json({ error: true, msg: err.message });
        }
        const patients = results.map(patient => ({
            patientId: patient.patient_id,
            firstName: patient.first_name,
            lastName: patient.last_name,
            dateOfBirth: patient.date_of_birth,
            gender: patient.gender,
            contact: {
                phone: patient.phone,
                email: patient.email,
                address: patient.address
            },
            createdAt: patient.created_at,
            updatedAt: patient.updated_at
        }));
        res.json({ error: false, data: patients });
    });
});

// ดึงข้อมูลผู้ป่วยตาม patient_id
app.get('/getPatient/:id', (req, res) => {
    const patientId = req.params.id;

    const sql = `
        SELECT patient_id, first_name, last_name,date_of_birth,gender,phone,email,address,created_at,updated_at FROM patients WHERE patient_id = ?`;
    connection.query(sql, [patientId], (err, results) => {
        if (err) {
            return res.status(500).json({ error: true, msg: err.message });
        }

        if (results.length === 0) {
            return res.status(404).json({ error: true, msg: "Patient not found" });
        }

        const patient = results[0];
        const patientData = {
            patientId: patient.patient_id,
            firstName: patient.first_name,
            lastName: patient.last_name,
            dateOfBirth: patient.date_of_birth,
            gender: patient.gender,
            contact: {
                phone: patient.phone,
                email: patient.email,
                address: patient.address
            },
            createdAt: patient.created_at,
            updatedAt: patient.updated_at
        };

        res.json({ error: false, data: patientData });
    });
});

app.post('/addPatient', (req, res) => {
    const { patient_id, first_name, last_name, date_of_birth, gender, phone, email, address } = req.body;

    if (!patient_id || !first_name || !last_name || !date_of_birth || !gender) {
        return res.json({ error: true, msg: "Missing required fields" });
    }

    const sql = `INSERT INTO patients (patient_id, first_name, last_name, date_of_birth, gender, phone, email, address, created_at, updated_at) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`;

    const values = [patient_id, first_name, last_name, date_of_birth, gender, phone, email, address || ''];

    connection.query(sql, values, (err, results) => {
        if (err) {
            console.error("Error inserting user:", err);
            return res.json({ error: true, msg: "Cannot Insert", details: err.code || err.sqlMessage });
        }
        if (results.affectedRows === 0) {
            return res.json({ error: true, msg: "No rows inserted" });
        }
        res.json({ error: false, data: results, msg: "Inserted successfully" });
    });
});



// Appointments API
app.get('/getAppointments/:patientId', (req, res) => {
    connection.query('SELECT * FROM appointments WHERE patient_id = ? ORDER BY appointment_date DESC', [req.params.patientId], (err, results) => {
        res.json(err ? { error: "Database error", details: err } : results);
    });
});

app.post('/addAppointments', (req, res) => {
    let { appointment_id, patient_id, user_id, appointment_date, clinic } = req.body;

    // ตรวจสอบค่าที่รับมา
    console.log('Received data:', req.body);

    // ตรวจสอบว่า appointment_id ซ้ำหรือไม่
    connection.query(
        'SELECT * FROM appointments WHERE appointment_id = ?',
        [appointment_id],
        (err, results) => {
            if (err) {
                console.log('Database error:', err);
                return res.status(500).json({ error: "Database error", details: err });
            }
            if (results.length > 0) {
                return res.status(400).json({ error: "Duplicate appointment_id" });
            }

            // ถ้าไม่มีค่า appointment_id ซ้ำ ให้เพิ่มลงฐานข้อมูล
            console.log('appointment_id:', appointment_id);
            console.log('patient_id:', patient_id);
            console.log('user_id:', user_id);
            console.log('appointment_date:', appointment_date);
            console.log('clinic:', clinic);

            connection.query(
                'INSERT INTO appointments (appointment_id, patient_id, user_id, appointment_date, clinic) VALUES (?, ?, ?, ?, ?)',
                [appointment_id, patient_id, user_id, appointment_date, clinic],
                (err, results) => {
                    if (err) {
                        console.log('Insert error:', err);
                        return res.status(500).json({ error: "Cannot insert", details: err });
                    } else {
                        res.status(201).json({ message: "Appointment added", data: results });
                    }
                }
            );
        }
    );
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
