export type Category = 'Food'|'Rent'|'Shopping'|'Travel'|'Bills'|'Salary'|'Health'|'Transfer'|'Other';
export interface Transaction { id:string; title:string; subtitle:string; category:Category; amount:number; date:string; kind:'income'|'expense'; recurring?:boolean; }
export interface SavingsGoal { id:string; title:string; saved:number; target:number; icon:string; }
export interface Insight { title:string; body:string; tone:'purple'|'green'|'amber'; }
