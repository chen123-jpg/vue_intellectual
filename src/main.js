import { createApp } from 'vue'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import './style.css'  
import App from './App.vue'

const app = createApp(App)   // 用变量接收
app.use(ElementPlus)         // 注册插件
app.mount('#app')            // 挂载


