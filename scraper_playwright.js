import { chromium } from 'playwright';
import * as cheerio from 'cheerio';
import fs from 'fs/promises';
import path from 'path';

const BASE_URL = 'https://www.examtopics.com/exams/amazon/aws-certified-solutions-architect-associate-saa-c02/view/';
const OUTPUT_FILE = 'quiz_data.json';

// Parse command line arguments: node scraper_playwright.js [startPage] [endPage]
const startPageArg = parseInt(process.argv[2], 10);
const endPageArg = parseInt(process.argv[3], 10);

const START_PAGE = !isNaN(startPageArg) ? startPageArg : 1;
const END_PAGE = !isNaN(endPageArg) ? endPageArg : 82;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function getPageUrl(page) {
  if (page === 1) {
    return BASE_URL;
  }
  return `${BASE_URL}${page}/`;
}

async function loadExistingQuestions() {
  try {
    const data = await fs.readFile(OUTPUT_FILE, 'utf-8');
    const parsed = JSON.parse(data);
    if (Array.isArray(parsed)) {
      console.log(`[ℹ] Found ${parsed.length} existing questions in ${OUTPUT_FILE}.`);
      return parsed;
    }
  } catch {
    // File doesn't exist or is invalid JSON
  }
  return [];
}

async function saveQuestions(questions) {
  await fs.writeFile(OUTPUT_FILE, JSON.stringify(questions, null, 2));
}

function parseQuestionsFromHtml(html) {
  const $ = cheerio.load(html);
  const questions = [];

  $('.exam-question-card').each((_, element) => {
    const questionHeader = $(element).find('.card-header').text().trim().replace(/\s+/g, ' ');
    const questionText = $(element).find('.card-text').first().text().trim().replace(/\s+/g, ' ');
    const correctAnswer = $(element).find('.correct-answer').text().trim();

    const choices = [];
    $(element).find('.question-choices-container li').each((_, choiceEl) => {
      choices.push($(choiceEl).text().trim().replace(/\s+/g, ' '));
    });

    questions.push({
      header: questionHeader,
      question: questionText,
      choices: choices,
      correctAnswer: correctAnswer,
    });
  });

  return questions;
}

async function main() {
  console.log(`====================================================`);
  console.log(`  ExamTopics Interactive Playwright Scraper`);
  console.log(`  Target Pages: ${START_PAGE} to ${END_PAGE}`);
  console.log(`  Output: ${OUTPUT_FILE}`);
  console.log(`====================================================\n`);

  let allQuestions = [];
  if (START_PAGE > 1) {
    allQuestions = await loadExistingQuestions();
  }

  // Launch visible browser so the user can solve CAPTCHAs if prompted
  console.log(`[+] Launching Chromium browser...`);
  const browser = await chromium.launch({
    headless: false,
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });

  const page = await context.newPage();

  // Graceful shutdown handler
  const handleExit = async () => {
    console.log(`\n[!] Saving ${allQuestions.length} questions before exit...`);
    await saveQuestions(allQuestions);
    await browser.close();
    process.exit(0);
  };
  process.on('SIGINT', handleExit);
  process.on('SIGTERM', handleExit);

  for (let pageNum = START_PAGE; pageNum <= END_PAGE; pageNum++) {
    const url = getPageUrl(pageNum);
    console.log(`\n[+] [Page ${pageNum}/${END_PAGE}] Navigating to: ${url}`);

    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });

      // Wait briefly for either question cards or CAPTCHA element
      await page.waitForSelector('.exam-question-card, .captcha-container, .g-recaptcha', {
        timeout: 10000,
      }).catch(() => {});

      let cards = await page.$$('.exam-question-card');

      // If cards are not found, we hit the CAPTCHA page
      if (cards.length === 0) {
        console.log(`\n------------------------------------------------------------`);
        console.log(`⚠️  [CAPTCHA REQUIRED] on page ${pageNum}!`);
        console.log(`👉 Please click / complete the CAPTCHA in the open Chromium browser window.`);
        console.log(`⏳ Waiting for verification to complete...`);
        console.log(`------------------------------------------------------------\n`);

        // Wait indefinitely until question cards appear after CAPTCHA is solved
        await page.waitForSelector('.exam-question-card', { timeout: 0 });
        console.log(`✔ CAPTCHA resolved! Continuing scrape...`);
      }

      // Allow a brief moment for dynamic rendering
      await sleep(1000);

      const html = await page.content();
      const pageQuestions = parseQuestionsFromHtml(html);

      if (pageQuestions.length === 0) {
        console.warn(`⚠️  No questions parsed on page ${pageNum}.`);
      } else {
        // Avoid duplicate headers if resuming
        const existingHeaders = new Set(allQuestions.map((q) => q.header));
        const newQuestions = pageQuestions.filter((q) => !existingHeaders.has(q.header));

        allQuestions.push(...newQuestions);
        console.log(`✔ Extracted ${newQuestions.length} new questions (Total accumulated: ${allQuestions.length})`);

        // Save progress after each page
        await saveQuestions(allQuestions);
      }

      // Polite random delay between requests (1.5s - 2.5s)
      if (pageNum < END_PAGE) {
        const delay = Math.floor(Math.random() * 1000) + 1500;
        console.log(`⏳ Waiting ${(delay / 1000).toFixed(1)}s before next page...`);
        await sleep(delay);
      }
    } catch (error) {
      console.error(`✘ Error on page ${pageNum}: ${error.message}`);
      console.log(`Saving progress before continuing...`);
      await saveQuestions(allQuestions);
    }
  }

  console.log(`\n====================================================`);
  console.log(`✔ Scraping Completed!`);
  console.log(`✔ Total Questions Collected: ${allQuestions.length}`);
  console.log(`✔ Saved to: ${OUTPUT_FILE}`);
  console.log(`====================================================`);

  await browser.close();
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
