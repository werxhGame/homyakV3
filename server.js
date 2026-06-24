const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const app = express();
const PORT = process.env.PORT || 3000;

// ===== ЛОГИРОВАНИЕ ДЛЯ ОТЛАДКИ =====
console.log('✅ Сервер запускается...');

app.use(cors());
app.use(express.json());

// ===== ПОДКЛЮЧЕНИЕ К MONGODB =====
const MONGO_URI = 'mongodb+srv://Admin:homyakV3_212400@cluster0.owsi01j.mongodb.net/homyak?retryWrites=true&w=majority';

console.log('🔍 Пытаюсь подключиться к MongoDB...');

mongoose.connect(MONGO_URI)
  .then(() => console.log('✅ Подключено к MongoDB'))
  .catch(err => {
    console.error('❌ Ошибка подключения к MongoDB:', err.message);
    // Сервер продолжит работу даже без MongoDB (для отладки)
  });

// ===== СХЕМА ПОЛЬЗОВАТЕЛЯ =====
const userSchema = new mongoose.Schema({
    username: { type: String, unique: true, required: true },
    password: { type: String, required: true },
    refCode: String,
    referredBy: String,
    taps: { type: Number, default: 0 },
    tokens: { type: Number, default: 0 },
    gems: { type: Number, default: 0 },
    totalClicks: { type: Number, default: 0 },
    rebirthCount: { type: Number, default: 0 },
    clickPower: { type: Number, default: 1 },
    inventory: { type: Array, default: [] },
    dailyClaimed: { type: Array, default: [] },
    autoClickers: { type: Number, default: 0 },
    clickUpgrade: { type: Number, default: 0 },
    autoClickerPrice: { type: Number, default: 25 },
    clickUpgradePrice: { type: Number, default: 10 },
    playTime: { type: Number, default: 0 },
    minerBest: { type: Number, default: 0 },
    soldItems: { type: Number, default: 0 },
    firstLogin: { type: Date, default: Date.now },
    lastDailyClaim: { type: Number, default: 0 },
    activeBoosts: { type: Object, default: {} },
    creatorUnlocked: { type: Boolean, default: false },
    creatorUnlockedForever: { type: Boolean, default: false },
    _ownerUnlockNotified: { type: Boolean, default: false },
    workSlots: { type: Array, default: Array(9).fill(null) },
    hamsterIdCounter: { type: Number, default: 0 },
    banned: { type: Boolean, default: false },
    banReason: { type: String, default: '' }
});

const chatSchema = new mongoose.Schema({
    username: String,
    message: String,
    timestamp: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);
const Chat = mongoose.model('Chat', chatSchema);

console.log('✅ Схемы созданы');

// ============================================================
//  API
// ============================================================

// РЕГИСТРАЦИЯ
app.post('/register', async (req, res) => {
    try {
        const { username, password, refCode } = req.body;
        if (!username || !password) {
            return res.status(400).json({ error: 'Заполните все поля' });
        }
        const existing = await User.findOne({ username });
        if (existing) {
            return res.status(400).json({ error: 'Такой ник уже занят' });
        }
        const newUser = new User({
            username,
            password,
            refCode: username.slice(0,4) + Math.random().toString(36).slice(2,6).toUpperCase()
        });
        if (refCode) {
            const referrer = await User.findOne({ refCode });
            if (referrer) {
                referrer.gems += 60;
                referrer.tokens += 150;
                await referrer.save();
                newUser.taps = 5000;
                newUser.referredBy = referrer.username;
            }
        }
        await newUser.save();
        res.json({ success: true, message: 'Регистрация успешна!' });
    } catch (err) {
        console.error('❌ Ошибка регистрации:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// ВХОД
app.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await User.findOne({ username });
        if (!user || user.password !== password) {
            return res.status(400).json({ error: 'Неверный ник или пароль' });
        }
        if (user.banned) {
            return res.status(403).json({ error: '⛔ Вы забанены! Причина: ' + user.banReason });
        }
        res.json({
            success: true,
            user: {
                username: user.username,
                taps: user.taps,
                tokens: user.tokens,
                gems: user.gems,
                totalClicks: user.totalClicks,
                rebirthCount: user.rebirthCount,
                clickPower: user.clickPower,
                inventory: user.inventory,
                dailyClaimed: user.dailyClaimed,
                autoClickers: user.autoClickers,
                clickUpgrade: user.clickUpgrade,
                autoClickerPrice: user.autoClickerPrice,
                clickUpgradePrice: user.clickUpgradePrice,
                playTime: user.playTime,
                minerBest: user.minerBest,
                soldItems: user.soldItems,
                firstLogin: user.firstLogin,
                lastDailyClaim: user.lastDailyClaim,
                activeBoosts: user.activeBoosts,
                creatorUnlocked: user.creatorUnlocked,
                creatorUnlockedForever: user.creatorUnlockedForever,
                _ownerUnlockNotified: user._ownerUnlockNotified,
                refCode: user.refCode,
                referredBy: user.referredBy,
                workSlots: user.workSlots,
                hamsterIdCounter: user.hamsterIdCounter,
                banned: user.banned,
                banReason: user.banReason
            }
        });
    } catch (err) {
        console.error('❌ Ошибка входа:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// СОХРАНЕНИЕ ПРОГРЕССА
app.post('/save', async (req, res) => {
    try {
        const { username, data } = req.body;
        const user = await User.findOne({ username });
        if (!user) {
            return res.status(404).json({ error: 'Пользователь не найден' });
        }
        if (user.banned) {
            return res.status(403).json({ error: '⛔ Вы забанены!' });
        }
        Object.keys(data).forEach(key => {
            if (key !== 'username' && key !== 'password' && key !== '_id' && key !== 'banned' && key !== 'banReason') {
                user[key] = data[key];
            }
        });
        await user.save();
        res.json({ success: true });
    } catch (err) {
        console.error('❌ Ошибка сохранения:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// БАН ПО НИКУ
app.post('/ban-nick', async (req, res) => {
    try {
        const { username, reason } = req.body;
        const user = await User.findOne({ username });
        if (!user) {
            return res.status(404).json({ error: 'Игрок не найден' });
        }
        user.banned = true;
        user.banReason = reason || 'Нарушение правил';
        await user.save();
        res.json({ success: true, message: 'Игрок ' + username + ' забанен' });
    } catch (err) {
        console.error('❌ Ошибка бана:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// РАЗБАН
app.post('/unban-nick', async (req, res) => {
    try {
        const { username } = req.body;
        const user = await User.findOne({ username });
        if (!user) {
            return res.status(404).json({ error: 'Игрок не найден' });
        }
        user.banned = false;
        user.banReason = '';
        await user.save();
        res.json({ success: true, message: 'Игрок ' + username + ' разбанен' });
    } catch (err) {
        console.error('❌ Ошибка разбана:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// ВЫДАЧА ПРЕДМЕТА
app.post('/give-item', async (req, res) => {
    try {
        const { username, item } = req.body;
        const user = await User.findOne({ username });
        if (!user) {
            return res.status(404).json({ error: 'Игрок не найден' });
        }
        if (!item || !item.emoji || !item.name) {
            return res.status(400).json({ error: 'Неверный формат предмета' });
        }
        user.inventory.push({
            id: 'gift_' + Date.now(),
            emoji: item.emoji,
            name: item.name,
            sellTap: item.sellTap || 0,
            sellToken: item.sellToken || 0,
            sellGems: item.sellGems || 0
        });
        await user.save();
        res.json({ success: true, message: 'Предмет ' + item.name + ' выдан игроку ' + username });
    } catch (err) {
        console.error('❌ Ошибка выдачи предмета:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// СПИСОК ИГРОКОВ
app.get('/users', async (req, res) => {
    try {
        const users = await User.find({}, 'username refCode gems tokens taps rebirthCount banned');
        res.json(users);
    } catch (err) {
        console.error('❌ Ошибка получения списка игроков:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// ОТПРАВКА СООБЩЕНИЯ В ЧАТ
app.post('/chat', async (req, res) => {
    try {
        const { username, message } = req.body;
        if (!username || !message) {
            return res.status(400).json({ error: 'Заполните все поля' });
        }
        const user = await User.findOne({ username });
        if (!user) {
            return res.status(404).json({ error: 'Пользователь не найден' });
        }
        if (user.banned) {
            return res.status(403).json({ error: '⛔ Вы забанены!' });
        }
        if (message.length > 500) {
            return res.status(400).json({ error: 'Сообщение слишком длинное' });
        }
        const chat = new Chat({ username, message });
        await chat.save();
        res.json({ success: true });
    } catch (err) {
        console.error('❌ Ошибка отправки сообщения:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// ПОЛУЧЕНИЕ СООБЩЕНИЙ ЧАТА
app.get('/chat', async (req, res) => {
    try {
        const messages = await Chat.find().sort({ timestamp: -1 }).limit(50);
        res.json(messages.reverse());
    } catch (err) {
        console.error('❌ Ошибка загрузки чата:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// ============================================================
//  ЗАПУСК СЕРВЕРА
// ============================================================
app.listen(PORT, () => {
    console.log(`✅ Сервер успешно запущен на порту ${PORT}`);
});

console.log('✅ Все роуты зарегистрированы, сервер готов к работе');
