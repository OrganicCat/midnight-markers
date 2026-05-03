import { checkBatch } from './brokenLinks';

const ALARM_NAME = 'broken-link-check';

chrome.runtime.onInstalled.addListener(() => {
  console.log('[midnight-markers] installed');
  chrome.alarms.create(ALARM_NAME, { periodInMinutes: 24 * 60 });
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === ALARM_NAME) {
    const r = await checkBatch();
    console.log('[midnight-markers] broken-link batch checked', r);
  }
});
