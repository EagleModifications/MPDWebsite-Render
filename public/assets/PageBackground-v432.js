import{c as e}from"./runtime-core.esm-bundler-v432.js";import{Z as t}from"./use-router-link-v432.js";import{s as n}from"./stores-v432.js";function r(r){let a=e(()=>r.value.pageGradient?`
        radial-gradient(
          at 0% 0%,
          ${t(o.value[0],.3)} 0px,
          rgb(0 0 0 / 0) 50%
        ),
        radial-gradient(
          at 98% 1%,
          ${t(o.value[1],.3)} 0px,
          rgb(0 0 0 / 0) 50%
        ),
        ${s.value}
      `:s.value),o=e(()=>{let e=n(r.value);return i(e)?[`#3369E8`,`#D50F25`]:e.length>r.value.entries.length?[e[0],e[Math.max(r.value.entries.length-1,0)]]:[e[0],e[e.length-1]]}),s=e(()=>r.value.pageBackgroundColor.toLowerCase()===`#ffffff`?`transparent`:r.value.pageBackgroundColor);return{pageBackgroundStyle:e(()=>({background:a.value}))}}function i(e){return e.length===4&&e[0]===`#3369E8`&&e[1]===`#D50F25`&&e[2]===`#EEB211`&&e[3]===`#009925`}export{r as t};