const AllTranslates = require("./Translates");

exports.generateContentEmail = ({
  alertType,
  companyChanged = false,
  language = "PL",
  itemAlert = null,
  collection,
}) => {
  let alertColor = "default";
  let isCompanyChanged = !!companyChanged ? companyChanged : false;
  let alertDate = "00-00-0000";
  let timeStartEnd = "0:00 - 0:00";
  let companyName = "Brak firmy";
  let companyLink = null;
  let title = null;
  let reserwation = null;
  let service = null;
  let communiting = null;
  const texts = AllTranslates.Translates[language.toUpperCase()].alerts;

  //reserwation
  if (collection === "Reserwation") {
    if (!!itemAlert.dateStart && !!itemAlert.dateEnd) {
      timeStartEnd = `${itemAlert.dateStart}-${itemAlert.dateEnd}`;
    }

    if (!!itemAlert.company) {
      if (!!itemAlert.company.name && !!itemAlert.company.linkPath) {
        companyName = itemAlert.company.name.toUpperCase();
        companyLink = itemAlert.company.linkPath;
      }
    }

    if (!!itemAlert.serviceName) {
      reserwation = itemAlert.serviceName;
    }

    if (!!itemAlert.dateDay && !!itemAlert.dateMonth && !!itemAlert.dateYear) {
      alertDate = `${
        itemAlert.dateDay < 10 ? `0${itemAlert.dateDay}` : itemAlert.dateDay
      }-${
        itemAlert.dateMonth < 10
          ? `0${itemAlert.dateMonth}`
          : itemAlert.dateMonth
      }-${itemAlert.dateYear}`;
    }
  } else if (collection === "Communiting") {
    //communiting
    if (!!alertDate.city) {
      communiting = alertDate.city;
    }
    if (!!alertDate.timeStart && !!alertDate.timeEnd) {
      timeStartEnd = `${alertDate.timeStart}-${alertDate.timeEnd}`;
    }
    if (!!alertDate.companyId) {
      if (!!alertDate.companyId.name && !!alertDate.companyId.linkPath) {
        companyName = itemAlert.company.name.toUpperCase();
        companyLink = itemAlert.company.linkPath;
      }
    }
    if (!!alertDate.day && !!alertDate.month && !!alertDate.year) {
      alertDate = `${
        alertDate.day < 10 ? `0${alertDate.day}` : alertDate.day
      }-${alertDate.month < 10 ? `0${alertDate.month}` : alertDate.month}-${
        alertDate.year
      }`;
    }
  } else if (collection === "Service") {
    //service
    if (!!alertDate.companyId) {
      if (!!alertDate.companyId.name && !!alertDate.companyId.linkPath) {
        companyName = itemAlert.company.name.toUpperCase();
        companyLink = itemAlert.company.linkPath;
      }
    }
    if (!!alertDate.serviceName) {
      service = alertDate.serviceName;
    }
    if (!!alertDate.day && !!alertDate.month && !!alertDate.year) {
      alertDate = `${
        alertDate.day < 10 ? `0${alertDate.day}` : alertDate.day
      }-${alertDate.month < 10 ? `0${alertDate.month}` : alertDate.month}-${
        alertDate.year
      }`;
    }
  } else {
    if (!!alertDate.name && !!alertDate.linkPath) {
      companyName = itemAlert.name.toUpperCase();
      companyLink = itemAlert.linkPath;
    }
  }

  switch (alertType) {
    case "reserwation_created": {
      alertColor = "green";
      if (isCompanyChanged) {
        title = `${texts[alertType].companyChangedUser.title[0]} ${companyName} ${texts[alertType].companyChangedUser.title[1]}`;
      } else {
        title = `${texts[alertType].noCompanyChangedUser.title[0]} ${companyName}`;
      }
      break;
    }
    case "reserwation_changed": {
      alertColor = "orange";
      if (isCompanyChanged) {
        title = `${texts[alertType].companyChangedUser.title[0]} ${companyName} ${texts[alertType].companyChangedUser.title[1]}`;
      } else {
        title = `${texts[alertType].noCompanyChangedUser.title[0]} ${companyName}`;
      }
      break;
    }
    case "reserwation_canceled": {
      alertColor = "red";
      if (isCompanyChanged) {
        title = `${texts[alertType].companyChangedUser.title[0]} ${companyName} ${texts[alertType].companyChangedUser.title[1]}`;
      } else {
        title = `${texts[alertType].noCompanyChangedUser.title[0]} ${companyName}`;
      }
      break;
    }
    case "reserwation_finished": {
      alertColor = "green";
      if (isCompanyChanged) {
        title = `${texts[alertType].companyChangedUser.title[0]} ${companyName} ${texts[alertType].companyChangedUser.title[1]}`;
      }
      break;
    }
    case "reserwation_not_finished": {
      alertColor = "red";
      if (isCompanyChanged) {
        title = `${texts[alertType].companyChangedUser.title[0]} ${companyName} ${texts[alertType].companyChangedUser.title[1]}`;
      }

      break;
    }
    case "reserwation_notifaction": {
      alertColor = "blue";
      if (isCompanyChanged) {
        title = `${texts[alertType].companyChangedUser.title[0]} ${companyName} ${texts[alertType].companyChangedUser.title[1]}`;
      }
      break;
    }
    case "reserwation_worker_created": {
      alertColor = "gray";
      if (isCompanyChanged) {
        title = `${texts[alertType].companyChangedUser.title[0]} ${companyName}`;
      }
      break;
    }
    case "reserwation_worker_changed": {
      alertColor = "gray";
      if (isCompanyChanged) {
        title = `${texts[alertType].companyChangedUser.title[0]} ${companyName}`;
      }
      break;
    }
    case "reserwation_worker_canceled": {
      alertColor = "gray";
      if (isCompanyChanged) {
        title = `${texts[alertType].companyChangedUser.title[0]} ${companyName}`;
      }
      break;
    }
    case "opinion_client": {
      alertColor = "gray";
      if (!isCompanyChanged) {
        title = `${texts[alertType].noCompanyChangedUser.title[0]} ${companyName}`;
      }
      break;
    }
    case "opinion_client_edit": {
      alertColor = "gray";
      if (!isCompanyChanged) {
        title = `${texts[alertType].noCompanyChangedUser.title[0]} ${companyName}`;
      }
      break;
    }
    case "opinion_from_company": {
      alertColor = "gray";
      if (isCompanyChanged) {
        title = `${texts[alertType].companyChangedUser.title[0]} ${companyName} ${texts[alertType].companyChangedUser.title[1]}`;
      }
      break;
    }
    case "commuting_created": {
      alertColor = "green";
      if (isCompanyChanged) {
        title = `${texts[alertType].companyChangedUser.title[0]} ${companyName} ${texts[alertType].companyChangedUser.title[1]}`;
      }
      break;
    }
    case "commuting_changed": {
      alertColor = "orange";
      if (isCompanyChanged) {
        title = `${texts[alertType].companyChangedUser.title[0]} ${companyName} ${texts[alertType].companyChangedUser.title[1]}`;
      }
      break;
    }
    case "commuting_deleted": {
      alertColor = "red";
      if (isCompanyChanged) {
        title = `${texts[alertType].companyChangedUser.title[0]} ${companyName} ${texts[alertType].companyChangedUser.title[1]}`;
      } else {
        title = `${texts[alertType].noCompanyChangedUser.title[0]} ${companyName}`;
      }
      break;
    }
    case "commuting_canceled": {
      alertColor = "red";
      if (isCompanyChanged) {
        title = `${texts[alertType].companyChangedUser.title[0]} ${companyName} ${texts[alertType].companyChangedUser.title[1]}`;
      } else {
        title = `${texts[alertType].noCompanyChangedUser.title[0]} ${companyName}`;
      }
      break;
    }
    case "service_created": {
      alertColor = "green";
      if (isCompanyChanged) {
        title = `${texts[alertType].companyChangedUser.title[0]} ${companyName} ${texts[alertType].companyChangedUser.title[1]}`;
      }
      break;
    }
    case "service_changed": {
      alertColor = "orange";
      if (isCompanyChanged) {
        title = `${texts[alertType].companyChangedUser.title[0]} ${companyName} ${texts[alertType].companyChangedUser.title[1]}`;
      }
      break;
    }
    case "service_deleted": {
      alertColor = "red";
      if (isCompanyChanged) {
        title = `${texts[alertType].companyChangedUser.title[0]} ${companyName} ${texts[alertType].companyChangedUser.title[1]}`;
      } else {
        title = `${texts[alertType].noCompanyChangedUser.title[0]} ${companyName}`;
      }
      break;
    }
    case "service_canceled": {
      alertColor = "red";
      if (isCompanyChanged) {
        title = `${texts[alertType].companyChangedUser.title[0]} ${companyName} ${texts[alertType].companyChangedUser.title[1]}`;
      } else {
        title = `${texts[alertType].noCompanyChangedUser.title[0]} ${companyName}`;
      }
      break;
    }
    case "service_finished": {
      alertColor = "green";
      if (isCompanyChanged) {
        title = `${texts[alertType].companyChangedUser.title[0]} ${companyName} ${texts[alertType].companyChangedUser.title[1]}`;
      }
      break;
    }
    case "alert_notifaction_sms": {
      alertColor = "red";
      if (isCompanyChanged) {
        title = `${texts[alertType].companyChangedUser.title[0]} ${companyName} ${texts[alertType].companyChangedUser.title[1]}`;
      }
      break;
    }
    case "alert_notifaction_premium": {
      alertColor = "red";
      if (isCompanyChanged) {
        title = `${texts[alertType].companyChangedUser.title[0]} ${companyName} ${texts[alertType].companyChangedUser.title[1]}`;
      }
      break;
    }

    default: {
      alertColor = "red";
      title = texts.general.alertNotFound;
      break;
    }
  }

  const dayText = texts.general.dayText;
  const hoursText = texts.general.hoursText;
  const reserwationText = texts.general.reserwationText;
  const serviceText = texts.general.serviceText;
  const communitingText = texts.general.communitingText;

  return {
    alertColor: alertColor,
    title: title,
    day: alertDate,
    hours: timeStartEnd,
    reserwation: reserwation,
    service: service,
    communiting: communiting,
    alertDate: alertDate,
    timeStartEnd: timeStartEnd,
    companyLink: companyLink,
    dayText: dayText,
    hoursText: hoursText,
    reserwationText: reserwationText,
    serviceText: serviceText,
    communitingText: communitingText,
  };
};
