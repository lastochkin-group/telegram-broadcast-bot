const express = require('express');
const { Telegraf, Markup } = require('telegraf');
const supabase = require('./utils/supabase')
const axios = require('axios');
const Queue = require('bull');
const Redis = require('ioredis');
const moment = require('moment-timezone');
const config = require('./config.json');

const app = express();
app.use(express.json());

const API_KEY = 'your_default_api_key'; // Установите значение API ключа

let bot;

// Настройка очереди для рассылок
const broadcastQueue = new Queue('broadcastQueue', {
    redis: {
        host: '127.0.0.1',
        port: 6379
    }
});

// Настройка клиента Redis для хранения состояния
const redisClient = new Redis();

// Функция отправки сообщений пользователям
async function sendMessageToUsers({ jobId, messageText, imageUrl, buttons, estimatedUserCount, reportChatId, webhookUrl, reportIntervalMinutes, testUsers }) {
    try {
        bot = new Telegraf(config.BOT_TOKEN);
        let messages_sent = await redisClient.get(`${jobId}:messages_sent`) || 0;
        let errors = await redisClient.get(`${jobId}:errors`) || 0;
        let last_user_id = await redisClient.get(`${jobId}:last_user_id`) || 0;
        let keepSending = true;
        const startTime = Date.now();
        let reportMessageId = null;

        const sendOrUpdateReport = async () => {
            const elapsedTime = (Date.now() - startTime) / 1000;
            const progress = estimatedUserCount ? (messages_sent / estimatedUserCount) * 100 : null;
            const estimatedTime = estimatedUserCount ? (elapsedTime / messages_sent) * (estimatedUserCount - messages_sent) : null;

            const reportText = `
            Рассылка ID: ${jobId}
            - Отправлено сообщений: ${messages_sent}
            - Ошибок: ${errors}
            - Прошло времени: ${elapsedTime.toFixed(2)}s
            ${progress ? `- Прогресс: ${progress.toFixed(2)}%` : ''}
            ${estimatedTime ? `- Примерное время до окончания: ${estimatedTime.toFixed(2)}s` : ''}
            `;

            if (webhookUrl) {
                try {
                    await axios.post(webhookUrl, { text: reportText });
                } catch (err) {
                    console.error('Ошибка отправки на webhook:', err.message);
                }
            }

            if (reportChatId && bot) {
                try {
                    if (reportMessageId) {
                        await bot.telegram.editMessageText(reportChatId, reportMessageId, null, reportText);
                    } else {
                        const newMessage = await bot.telegram.sendMessage(reportChatId, reportText);
                        reportMessageId = newMessage.message_id;
                    }
                } catch (error) {
                    console.error('Ошибка отправки отчета в Telegram:', error.message);
                }
            }
        };

        // Запуск интервала отчетности
        const reportInterval = setInterval(() => sendOrUpdateReport(), reportIntervalMinutes * 60000);

        while (keepSending) {
            const isCancelled = await redisClient.get(`${jobId}:cancelled`);
            if (isCancelled) {
                console.log(`Рассылка ${jobId} отменена.`);
                clearInterval(reportInterval);
                return;
            }

            let users;
            if (testUsers && testUsers.length > 0) {
                // Используем тестовых пользователей, если они указаны
                users = testUsers;
                keepSending = false; // Завершаем цикл после обработки всех тестовых пользователей
            } else {
                // Получаем пользователей из базы данных
                let { data, error } = await supabase
                    .rpc('get_users_after_last_user', {
                        p_last_user_id: last_user_id,
                        p_limit_rows: 500
                    });

                if (error) {
                    console.error(error);
                    break;
                } else {
                    users = data;
                }

                if (users.length === 0) {
                    console.log('Все пользователи обработаны.');
                    keepSending = false;
                    await redisClient.set(`${jobId}:completed`, 1);
                    break;
                }
            }

            for (let i = 0; i < users.length; i += 30) {
                const batch = users.slice(i, i + 30);
                await Promise.all(batch.map(async (user) => {
                    const options = {
                        parse_mode: 'Markdown',
                        reply_markup: {
                            inline_keyboard: [buttons],
                        }
                    };

                    try {
                        if (imageUrl) {
                            await bot.telegram.sendPhoto(user.chat_id, imageUrl, { caption: messageText, ...options });
                        } else {
                            await bot.telegram.sendMessage(user.chat_id, messageText, options);
                        }
                        messages_sent++;
                        await redisClient.set(`${jobId}:messages_sent`, messages_sent);
                    } catch (err) {
                        errors++;
                        await redisClient.set(`${jobId}:errors`, errors);
                        console.error('Ошибка отправки сообщения:', err.message);
                    }
                }));
                last_user_id = batch[batch.length - 1].chat_id;
                await redisClient.set(`${jobId}:last_user_id`, last_user_id);
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }

        clearInterval(reportInterval);
        if (reportChatId || webhookUrl) {
            await sendOrUpdateReport();
        }
        console.log(`Рассылка ${jobId} завершена.`);

    } catch (error) {
        console.error(`Ошибка при выполнении рассылки ${jobId}:`, error.message);
    }
}

// Обработка задач в очереди
broadcastQueue.process(async (job) => {
    console.log('Обработка задачи:', job.id);
    await sendMessageToUsers({ ...job.data, jobId: job.id });
    return { jobId: job.id };
});

// Запуск новой рассылки
app.post('/start-broadcast', async (req, res) => {
    try {
        const { messageText, imageUrl, buttons, estimatedUserCount, reportChatId, webhookUrl, reportIntervalMinutes, scheduledTime, testUsers } = req.body;
        const apiKey = req.headers['x-api-key'];

        // Проверка обязательных полей
        if (!messageText) {
            return res.status(400).json({ error: 'messageText обязательное поле.' });
        }

        // Проверка API ключа
        if (apiKey !== API_KEY) {
            return res.status(403).json({ error: 'Недопустимый API ключ.' });
        }

        // Установка значений по умолчанию для необязательных полей
        const finalReportIntervalMinutes = reportIntervalMinutes ? parseInt(reportIntervalMinutes) : 1; // 1 минута по умолчанию
        const finalButtons = buttons || [];
        const finalEstimatedUserCount = estimatedUserCount ? parseInt(estimatedUserCount) : null;
        const finalImageUrl = imageUrl || null;
        const finalReportChatId = reportChatId || null;
        const finalWebhookUrl = webhookUrl || null;

        let jobOptions = {};

        if (scheduledTime) {
            // Конвертация времени из МСК в серверное время
            const serverTime = moment.tz(scheduledTime, 'DD.MM.YYYY HH:mm', 'Europe/Moscow').tz(moment.tz.guess());

            // Проверка, чтобы указанное время не было в прошлом
            if (serverTime.isBefore(moment())) {
                return res.status(400).json({ error: 'Указанное время не может быть в прошлом.' });
            }

            jobOptions.delay = serverTime.diff(moment());
        }

        const job = await broadcastQueue.add({
            messageText,
            imageUrl: finalImageUrl,
            buttons: finalButtons,
            estimatedUserCount: finalEstimatedUserCount,
            reportChatId: finalReportChatId,
            webhookUrl: finalWebhookUrl,
            reportIntervalMinutes: finalReportIntervalMinutes,
            testUsers // Передаем тестовых пользователей в задачу
        }, jobOptions);

        res.status(200).json({ message: 'Задача рассылки добавлена в очередь.', jobId: job.id, scheduledTime: scheduledTime || 'Сразу' });
    } catch (error) {
        console.error('Ошибка при добавлении задачи в очередь:', error.message);
        res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
});

// Отмена рассылки
app.post('/cancel-broadcast', async (req, res) => {
    try {
        const { jobId } = req.body;

        if (!jobId) {
            return res.status(400).json({ error: 'Необходимо указать ID задачи.' });
        }

        await redisClient.set(`${jobId}:cancelled`, 1);

        if (jobId === 'all') {
            const jobs = await broadcastQueue.getWaiting();
            jobs.forEach(job => job.remove());
            res.status(200).json({ message: 'Все задачи рассылки отменены.' });
        } else {
            res.status(200).json({ message: `Задача рассылки ${jobId} отменена.` });
        }
    } catch (error) {
        console.error('Ошибка при отмене задачи:', error.message);
        res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
});

// Запуск сервера
app.listen(config.PORT, () => {
    console.log('Сервер запущен на порту ' + config.PORT);
});
