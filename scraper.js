import axios from 'axios';
import * as cheerio from 'cheerio';
import fs from 'fs/promises';

const BASE_URL = 'https://www.examtopics.com/exams/amazon/aws-certified-solutions-architect-associate-saa-c02/view/';
const START_PAGE = 1;
const END_PAGE = 82;
const OUTPUT_FILE = 'quiz_data.json';
const DELAY_MS = 1500; // Polite delay between requests to avoid IP bans

// Optional: Provide session cookie if you are logged in or have solved the CAPTCHA in browser
// Can also be set via environment variable: COOKIE="sessionid=...; csrftoken=..." node scraper.js
const COOKIE = process.env.COOKIE || '';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function getPageUrl(page) {
  if (page === 1) {
    return BASE_URL;
  }
  return `${BASE_URL}${page}/`;
}

async function scrapePage(url, page) {
  const headers = {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept-Language': 'en-US,en;q=0.9',
    'Referer': page === 1 ? 'https://www.examtopics.com/' : getPageUrl(page - 1),
  };

  if (COOKIE) {
    headers['Cookie'] = COOKIE;
  }

  const { data: html } = await axios.get(url, {
    headers,
    timeout: 20000,
  });

  const $ = cheerio.load(html);

  // Check if ExamTopics presented a CAPTCHA challenge
  if ($('.captcha-container').length > 0 || $('h1').text().toLowerCase().includes('enter captcha')) {
    throw new Error(
      `CAPTCHA challenge detected on page ${page}. ExamTopics blocks automated requests past page 1. Provide a valid session cookie via COOKIE="sessionid=..." or solve the reCAPTCHA.`
    );
  }

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

async function scrapeAllPages(start = START_PAGE, end = END_PAGE) {
  const allQuestions = [];

  console.log(`[▶] Starting scraper from page ${start} to ${end}...`);
  console.log(`[ℹ] Base URL: ${BASE_URL}`);

  for (let page = start; page <= end; page++) {
    const url = getPageUrl(page);
    console.log(`[+] [${page}/${end}] Fetching: ${url}`);

    try {
      const pageQuestions = await scrapePage(url, page);

      if (pageQuestions.length === 0) {
        console.warn(`    ⚠️ Warning: 0 questions parsed from page ${page}.`);
      } else {
        allQuestions.push(...pageQuestions);
        console.log(`    ↳ Found ${pageQuestions.length} questions (Total: ${allQuestions.length})`);
        
        // Progressively save after each successful page
        await fs.writeFile(OUTPUT_FILE, JSON.stringify(allQuestions, null, 2));
      }

      // Wait between requests to prevent rapid-fire blocking
      if (page < end && DELAY_MS > 0) {
        await sleep(DELAY_MS);
      }
    } catch (error) {
      console.error(`    ✘ Error on page ${page}: ${error.message}`);
      
      // If blocked by CAPTCHA, inform user and break or stop
      if (error.message.includes('CAPTCHA challenge detected')) {
        console.error(`\n[!] Stopping scraper due to CAPTCHA restriction.`);
        console.error(`[!] Pages 1 to ${page - 1} were saved (${allQuestions.length} questions in ${OUTPUT_FILE}).`);
        break;
      }
    }
  }

  console.log(`\n[✔] Scraper finished.`);
  console.log(`[✔] Total questions collected: ${allQuestions.length}`);
  console.log(`[✔] Output saved to: ${OUTPUT_FILE}`);
}

scrapeAllPages();
