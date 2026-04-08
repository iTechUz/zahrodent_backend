import * as fs from 'fs';
import * as path from 'path';

const translations: Record<string, any> = {};

// Tarjimani yuklash funksiyasi
function loadTranslations() {
  const basePath = path.join(process.cwd(), 'src', 'i18n'); // `src` yoki `dist`ni qo‘llab-quvvatlash
  const languages = ['uz', 'ru', 'en'];

  languages.forEach((lang) => {
    const filePath = path.join(basePath, `${lang}.json`);
    if (fs.existsSync(filePath)) {
      try {
        const fileContent = fs.readFileSync(filePath, 'utf8');
        translations[lang] = JSON.parse(fileContent);
      } catch (e) {
        console.error(`Error loading translation file for ${lang}:`, e);
      }
    }
  });
}

// Tarjima funksiyasi
export function LangTranslate(key: string, lang: string, args: Record<string, string> = {}): string {
  if (Object.keys(translations).length === 0) {
    loadTranslations(); // Tarjimani yuklash (faqat bir marta)
  }
  const translation = translations[lang]?.[key] || key;
  return Object.keys(args).reduce(
    (text, argKey) => text.replace(`{{${argKey}}}`, args[argKey]),
    translation,
  );
}
