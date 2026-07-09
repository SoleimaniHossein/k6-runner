import http from 'k6/http';
import { check, sleep } from 'k6';
import exec from 'k6/execution';

const excelData = [{"ردیف":1,"پروژه":"oxygen pro","اپیک ":"زیرساخت","استوری":"تامین زیرساخت های پروژه ها جهت توسعه","سابتسک":"پشتیبانی  و نگهداری محیط توسعه","نوع تسک":"SUPPORT ","استیمیت":"9h","اونر":"Pourya","حوزه کار":"Infrastructure","زمان تحویل تسک":"HIGH"},{"ردیف":2,"پروژه":"oxygen pro","اپیک ":"زیرساخت","استوری":"تامین زیرساخت های پروژه ها جهت توسعه","سابتسک":"پشتیبانی ذینفعان","نوع تسک":"SUPPORT ","استیمیت":"9h","اونر":"Pourya","حوزه کار":"Infrastructure","زمان تحویل تسک":"HIGH"},{"ردیف":3,"پروژه":"oxygen pro","اپیک ":"زیرساخت","استوری":"تامین زیرساخت های پروژه ها جهت توسعه","سابتسک":"پشتیبانی  و نگهداری محیط توسعه","نوع تسک":"SUPPORT ","استیمیت":"9h","اونر":"Hossein","حوزه کار":"Infrastructure","زمان تحویل تسک":"HIGH"},{"ردیف":4,"پروژه":"oxygen pro","اپیک ":"زیرساخت","استوری":"تامین زیرساخت های پروژه ها جهت توسعه","سابتسک":"پشتیبانی ذینفعان","نوع تسک":"SUPPORT ","استیمیت":"9h","اونر":"Hossein","حوزه کار":"Infrastructure","زمان تحویل تسک":"HIGH"},{"ردیف":5,"پروژه":"oxygen pro","اپیک ":"زیرساخت","استوری":"تامین زیرساخت های پروژه ها جهت توسعه","سابتسک":"گزارش شرکت digipay","نوع تسک":"SUPPORT ","استیمیت":"6h","اونر":"Hossein","حوزه کار":"Infrastructure","زمان تحویل تسک":"HIGH"},{"ردیف":6,"پروژه":"oxygen pro","اپیک ":"زیرساخت","استوری":"تامین زیرساخت های پروژه ها جهت توسعه","سابتسک":"ایجاد نسخه کاستوم سیستم عامل های تیم توسعه","نوع تسک":"SUPPORT ","استیمیت":"12h","اونر":"Pourya","حوزه کار":"Infrastructure","زمان تحویل تسک":"HIGH"},{"ردیف":7,"پروژه":"oxygen pro","اپیک ":"زیرساخت","استوری":"تامین زیرساخت های پروژه ها جهت توسعه","سابتسک":"ایجاد نسخه کاستوم سیستم عامل های تیم توسعه","نوع تسک":"SUPPORT ","استیمیت":"12h","اونر":"Hossein","حوزه کار":"Infrastructure","زمان تحویل تسک":"HIGH"},{"ردیف":8,"پروژه":"oxygen pro","اپیک ":"زیرساخت","استوری":"تامین زیرساخت های پروژه ها جهت توسعه","سابتسک":"بررسی ساختار gateway عملیاتی با اکسین","نوع تسک":"SUPPORT ","استیمیت":"6h","اونر":"Pourya","حوزه کار":"Infrastructure","زمان تحویل تسک":"HIGH"},{"ردیف":9},{"ردیف":10},{"ردیف":11}];

const selectedColumns = ["ردیف"];

export const options = {
  "vus": 100000,
  "duration": "100s"
};

export default function() {
  const vu = __VU;
  const iter = __ITER;
  const progress = exec.scenario.progress;
  const percent = Math.round(progress * 100);
  console.log(JSON.stringify({ type: 'progress', percent, vu, iter, timestamp: Date.now() }));

  for (let i = 0; i < excelData.length; i++) {
    const row = excelData[i];
    const rowData = {};
    selectedColumns.forEach(col => { rowData[col] = row[col]; });
    console.log(JSON.stringify({ type: 'excel_row', row: i + 1, total: excelData.length, data: rowData }));

    let url = 'http://192.168.15.14:5555';
    url = url.replace(/{{ردیف}}/g, row['ردیف'] || '');

    const payload = null;
    const headers = {"Content-Type":"application/json"};
    const res = http.get(url, { headers });

    check(res, {
      'status is 200': (r) => r.status === 200,
      'response time < 500ms': (r) => r.timings.duration < 500,
    });

    sleep(1);
  }
}
