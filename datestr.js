
function dateToStr(date) {

    var year = date.getFullYear();
    var month = date.getMonth() + 1; // getMonth() is zero-based
    var day = date.getDate();
    var hour = date.getHours();
    var minute = date.getMinutes();
    var second = date.getSeconds();

    var strMonth = (month < 10 ? '0' : '') + String(month)
    var strDay = (day < 10 ? '0' : '') + String(day)
    var strHour = (hour < 10 ? '0' : '') + String(hour)
    var strMinute = (minute < 10 ? '0' : '') + String(minute)
    var strSecond = (second < 10 ? '0' : '') + String(second)

    return  String(year) + strMonth + strDay + strHour + strMinute + strSecond;

}

function dateToStrWM(date) {
    
    let ms = date.getMilliseconds()

    return dateToStr(date) + (ms < 100 ? '0' : '') + (ms < 10 ? '0' : '') + String(ms)

}


export default {

    dateToStr, dateToStrWM

}
