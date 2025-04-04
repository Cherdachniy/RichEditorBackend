const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');
const cors = require('cors');
const bodyParser = require('body-parser')


const app = express();
const port = process.env.PORT || 3000;
const db = new sqlite3.Database('users.sqlite')

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.use(cors({
    origin: 'http://localhost:5173',
    methods: ['GET', 'POST', 'PUT'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 600,
}));

app.post('/login', (request, response) => {
    if (!request.body) return res.sendStatus(400);

    const { username, password } = request.body;

    const query = 'SELECT * FROM users WHERE username = ? AND password = ?';
    db.get(query, [username, password], (error, row) => {
        if (error) {
            console.error('Ошибка при входе:', error);
            response.status(500).json({ error: error.message });
            return;
        } else if (!row) {
            response.status(401).json({ error: 'Неверное имя пользователя или пароль' });
        } else {
            response.status(200).json({ message: 'Вход успешен' });
        }
    })
})

app.post('/create-html', (request, response) => {
    if (!request.body) return response.sendStatus(400);

    // Получаем данные из тела запроса
    const { htmlContent, project, type } = request.body;

    // Проверяем, что все данные переданы
    if (!htmlContent) {
        return response.status(400).send('No HTML content provided');
    }

    if (!project || !type) {
        return response.status(400).send('Project name or type is missing');
    }

    // Построение пути для файла
    const projectPath = path.join(__dirname, 'docs', project, type);
    const filePath = path.join(projectPath, 'index.html');

    // Создаём директорию, если её нет
    fs.mkdir(projectPath, { recursive: true }, (err) => {
        if (err) {
            console.error('Error creating directory:', err);
            return response.status(500).send('Failed to create project directory');
        }

        // Генерация содержимого файла
        const templatePath = path.join(__dirname, 'template.html');
        fs.readFile(templatePath, 'utf8', (error, template) => {
            if (error) {
                console.error('Error reading template file:', error);
                return response.status(500).send('Failed to read template file');
            }

            const updatedContent = template.replace(/{data}/g, htmlContent);

            // Запись файла
            fs.writeFile(filePath, updatedContent, (writeErr) => {
                if (writeErr) {
                    console.error('Error writing file:', writeErr);
                    return response.status(500).send('Failed to write HTML file');
                }

                console.log(`File saved at ${filePath}`);
                response.send(`File successfully created or updated at ${filePath}`);
            });
        });
    });
});



app.get('/projects', (request, response) => {
    db.all('SELECT * FROM projects', (error, rows) => {
        if (error) {
            response.status(500).json({ error: err.message });
            return;
        }

        response.json(rows);
    })
})

app.get('/docs/:project_name/:type', (request, response) => {
    const { project_name, type } = request.params;
    console.log(`${project_name}/${type}`)

    const projectPath = path.join(__dirname, 'docs', project_name, type, 'index.html');

    if (!fs.existsSync(projectPath)) {
        return response.status(404).send('Project not found');
    }

    fs.readFile(projectPath, 'utf8', (error, data) => {
        if (error) {
            response.status(500).json({ error: error.message });
            return;
        }

        const $ = cheerio.load(data);
        const bodyContent = $('body').html();
        const clearBodyContent = bodyContent.trim();

        response.send(clearBodyContent);
    });
});


app.put('/projects/:project_name', (request, response) => {
    const project = request.body;

    db.run(`UPDATE projects SET privacy_doc = ?, terms_doc = ? WHERE project_name = ?`,
        [project.privacy_doc, project.terms_doc, project.project_name],
        (error) => {
            if (error) {
                console.error('Error updating project:', error);
                response.status(500).json({ error: error.message });
            } else {
                response.status(200).json({ message: 'Project updated successfully' });
            }
        });
});

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});