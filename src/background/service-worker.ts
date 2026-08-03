import { ext } from '$lib/ext';
import { checkBatch } from './brokenLinks';

const ALARM_NAME = 'broken-link-check';

ext.runtime.onInstalled.addListener(() => {
  console.log('[midnight-markers] installed');
  ext.alarms.create(ALARM_NAME, { periodInMinutes: 24 * 60 });
});

ext.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === ALARM_NAME) {
    const r = await checkBatch();
    console.log('[midnight-markers] broken-link batch checked', r);
  }
});
