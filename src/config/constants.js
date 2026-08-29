/**
 * MailGate Constants & Configurations
 */

module.exports = {
  // Risk Score Thresholds
  THRESHOLDS: {
    BLOCK: 70, // Scores >= 70 trigger automatic rejection
    FLAG: 35, // Scores >= 35 trigger CAPTCHA or secondary verification
  },

  // Generic Role Accounts (non-personal throwaways)
  ROLE_USERNAMES: new Set([
    'admin',
    'administrator',
    'support',
    'info',
    'sales',
    'contact',
    'postmaster',
    'billing',
    'help',
    'jobs',
    'privacy',
    'security',
    'abuse',
    'no-reply',
    'noreply',
    'test',
    'dev',
    'marketing',
    'office',
    'team',
    'hello',
    'general',
    'feedback',
    'press',
    'legal',
    'compliance',
  ]),

  // Legitimate Major Webmail Domains
  FREE_WEBMAIL_DOMAINS: new Set([
    'gmail.com',
    'yahoo.com',
    'hotmail.com',
    'outlook.com',
    'icloud.com',
    'aol.com',
    'proton.me',
    'protonmail.com',
    'zoho.com',
    'gmx.com',
    'mail.com',
    'yandex.com',
    'live.com',
    'msn.com',
    'me.com',
    'google.com',
  ]),

  // Common Typo-Squatted Domains
  TYPO_DOMAINS: new Set([
    'doogle.com',
    'gmaill.com',
    'gamil.com',
    'gmal.com',
    'gmaik.com',
    'yaho.com',
    'yahou.com',
    'yahoof.com',
    'hotmial.com',
    'hotmai.com',
    'outluk.com',
    'outloo.com',
    'icloude.com',
    'protonmai.com',
    'zohomail.com',
  ]),
};
