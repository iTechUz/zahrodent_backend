"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LangTranslate = LangTranslate;
const fs = require("fs");
const path = require("path");
const translations = {};
function loadTranslations() {
    const basePath = path.join(process.cwd(), 'src', 'i18n');
    const languages = ['uz', 'ru', 'en'];
    languages.forEach((lang) => {
        const filePath = path.join(basePath, `${lang}.json`);
        if (fs.existsSync(filePath)) {
            try {
                const fileContent = fs.readFileSync(filePath, 'utf8');
                translations[lang] = JSON.parse(fileContent);
            }
            catch (e) {
                console.error(`Error loading translation file for ${lang}:`, e);
            }
        }
    });
}
function LangTranslate(key, lang, args = {}) {
    if (Object.keys(translations).length === 0) {
        loadTranslations();
    }
    const translation = translations[lang]?.[key] || key;
    return Object.keys(args).reduce((text, argKey) => text.replace(`{{${argKey}}}`, args[argKey]), translation);
}
//# sourceMappingURL=i18n.js.map