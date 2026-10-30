import {SavingsGoal,Transaction} from '../types/finance';
export const transactions:Transaction[]=[
 {id:'1',title:'Salary Credit',subtitle:'NEFT · Acme Technologies',category:'Salary',amount:105000,date:'2026-10-01',kind:'income'},
 {id:'2',title:'Monthly Rent',subtitle:'UPI · Rohan Mehta',category:'Rent',amount:12000,date:'2026-10-03',kind:'expense',recurring:true},
 {id:'3',title:'Zomato',subtitle:'UPI · Food & dining',category:'Food',amount:1420,date:'2026-10-05',kind:'expense'},
 {id:'4',title:'Electricity Bill',subtitle:'BBPS · BESCOM',category:'Bills',amount:1850,date:'2026-10-07',kind:'expense',recurring:true},
 {id:'5',title:'BigBasket',subtitle:'UPI · Groceries',category:'Food',amount:2350,date:'2026-10-09',kind:'expense'},
 {id:'6',title:'Netflix',subtitle:'UPI · Subscription',category:'Bills',amount:499,date:'2026-10-10',kind:'expense',recurring:true},
 {id:'7',title:'Myntra',subtitle:'UPI · Shopping',category:'Shopping',amount:3499,date:'2026-10-12',kind:'expense'},
 {id:'8',title:'Uber',subtitle:'UPI · Travel',category:'Travel',amount:1180,date:'2026-10-14',kind:'expense'},
 {id:'9',title:'Mobile Recharge',subtitle:'UPI · Airtel',category:'Bills',amount:799,date:'2026-10-16',kind:'expense',recurring:true},
 {id:'10',title:'Pharmacy',subtitle:'UPI · Health',category:'Health',amount:680,date:'2026-10-18',kind:'expense'},
 {id:'11',title:'Cafe Coffee Day',subtitle:'UPI · Food & dining',category:'Food',amount:560,date:'2026-10-20',kind:'expense'},
 {id:'12',title:'Amazon',subtitle:'UPI · Shopping',category:'Shopping',amount:2899,date:'2026-10-23',kind:'expense'},
 {id:'13',title:'Fuel',subtitle:'Card · Travel',category:'Travel',amount:2200,date:'2026-10-25',kind:'expense'},
 {id:'14',title:'Freelance payment',subtitle:'IMPS · Design project',category:'Other',amount:8000,date:'2026-10-27',kind:'income'}
];
export const goals: SavingsGoal[]=[{id:'laptop',title:'Laptop fund',saved:24000,target:60000,icon:'laptop'},{id:'buffer',title:'Rainy day fund',saved:18000,target:50000,icon:'shield-checkmark'}];
export const categoryColors:Record<string,string>={Food:'#B889E9',Rent:'#6E8BE7',Shopping:'#F2B65C',Travel:'#64C6A0',Bills:'#F17F91',Health:'#64BBD3',Other:'#A5A1B4'};
