/**
 * New node file
 */
var schedule = require('node-schedule');
var crawler = require('./ctrls/crawler');
var brain = require('./ctrls/brain');

var rule = new schedule.RecurrenceRule();
rule.dayOfWeek = [
  new schedule.Range(1, 5)
];
rule.hour = [
  new schedule.Range(8, 17)
];
rule.minute = [
  new schedule.Range(0, 59, 20)
];

schedule.scheduleJob(rule, function() {
  crawler.today();
});

rule = new schedule.RecurrenceRule();
rule.dayOfWeek = 6;
rule.hour = 0;
rule.minute = 0;

schedule.scheduleJob(rule, function() {
  brain.train();
});

brain.train();