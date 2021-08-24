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
  let alertDate = null;
  let timeStartEnd = null;
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
    if (!!itemAlert.city) {
      communiting = itemAlert.city;
    }
    if (!!itemAlert.timeStart && !!itemAlert.timeEnd) {
      timeStartEnd = `${itemAlert.timeStart}-${itemAlert.timeEnd}`;
    }
    if (!!itemAlert.companyId) {
      if (!!itemAlert.companyId.name && !!itemAlert.companyId.linkPath) {
        companyName = itemAlert.companyId.name.toUpperCase();
        companyLink = itemAlert.companyId.linkPath;
      }
    }
    if (!!itemAlert.day && !!itemAlert.month && !!itemAlert.year) {
      alertDate = `${
        itemAlert.day < 10 ? `0${itemAlert.day}` : itemAlert.day
      }-${itemAlert.month < 10 ? `0${itemAlert.month}` : itemAlert.month}-${
        itemAlert.year
      }`;
    }
  } else if (collection === "Service") {
    //service
    if (!!itemAlert.companyId) {
      if (!!itemAlert.companyId.name && !!itemAlert.companyId.linkPath) {
        companyName = itemAlert.companyId.name.toUpperCase();
        companyLink = itemAlert.companyId.linkPath;
      }
    }
    if (!!itemAlert.objectName) {
      service = itemAlert.objectName;
    }

    if (!!itemAlert.day && !!itemAlert.month && !!itemAlert.year) {
      alertDate = `${
        itemAlert.day < 10 ? `0${itemAlert.day}` : itemAlert.day
      }-${itemAlert.month < 10 ? `0${itemAlert.month}` : itemAlert.month}-${
        itemAlert.year
      }`;
    }
  } else if (collection === "Default") {
  } else {
    if (!!itemAlert.name && !!itemAlert.linkPath) {
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
    case "commuting_notifaction": {
      alertColor = "blue";
      if (isCompanyChanged) {
        title = `${texts[alertType].companyChangedUser.title[0]} ${companyName} ${texts[alertType].companyChangedUser.title[1]}`;
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

    case "alert_payment_status": {
      alertColor = "orange";
      if (isCompanyChanged) {
        title = `${texts[alertType].companyChangedUser.title[0]}`;
      }
      break;
    }

    case "alert_payment_send_invoice": {
      alertColor = "orange";
      if (isCompanyChanged) {
        title = `${texts[alertType].companyChangedUser.title[0]}`;
      }
      break;
    }

    case "alert_create_account": {
      alertColor = "blue";
      title = `${texts[alertType].companyChangedUser.title[0]}`;

      break;
    }

    case "alert_confirm_account": {
      alertColor = "blue";
      title = `${texts[alertType].companyChangedUser.title[0]}`;

      break;
    }

    case "alert_invoice": {
      alertColor = "green";
      title = `${texts[alertType].companyChangedUser.title[0]}`;

      break;
    }

    case "alert_delete_company": {
      alertColor = "red";
      title = `${texts[alertType].companyChangedUser.title[0]}`;

      break;
    }

    case "alert_create_company": {
      alertColor = "red";
      title = `${texts[alertType].companyChangedUser.title[0]}`;

      break;
    }

    case "alert_created_account_social": {
      alertColor = "red";
      title = `${texts[alertType].companyChangedUser.title[0]}`;

      break;
    }

    case "alert_delete_account": {
      alertColor = "red";
      title = `${texts[alertType].companyChangedUser.title[0]}`;

      break;
    }

    case "alert_created_account_fb": {
      alertColor = "red";
      title = `${texts[alertType].companyChangedUser.title[0]}`;

      break;
    }
    case "alert_created_account_google": {
      alertColor = "red";
      title = `${texts[alertType].companyChangedUser.title[0]}`;

      break;
    }
    case "alert_reset_account_success": {
      alertColor = "red";
      title = `${texts[alertType].companyChangedUser.title[0]}`;

      break;
    }
    case "alert_reset_account_date": {
      alertColor = "red";
      title = `${texts[alertType].companyChangedUser.title[0]}`;

      break;
    }

    case "alert_reset_account": {
      alertColor = "red";
      title = `${texts[alertType].companyChangedUser.title[0]}`;

      break;
    }
    case "alert_confirm_account_edit": {
      alertColor = "red";
      title = `${texts[alertType].companyChangedUser.title[0]}`;

      break;
    }
    case "alert_confirm_account_phone": {
      alertColor = "red";
      title = `${texts[alertType].companyChangedUser.title[0]}`;

      break;
    }
    case "alert_veryfied_phone_account": {
      alertColor = "red";
      title = `${texts[alertType].companyChangedUser.title[0]}`;

      break;
    }
    case "alert_deleted_account_success": {
      alertColor = "red";
      title = `${texts[alertType].companyChangedUser.title[0]}`;

      break;
    }
    case "alert_delete_company_confirmed": {
      alertColor = "red";
      title = `${texts[alertType].companyChangedUser.title[0]}`;

      break;
    }

    case "alert_delete_company": {
      alertColor = "red";
      title = `${texts[alertType].companyChangedUser.title[0]}`;

      break;
    }

    case "alert_delete_worker_company": {
      alertColor = "red";
      title = `${texts[alertType].companyChangedUser.title[0]}`;

      break;
    }

    case "alert_confirm_worker_company": {
      alertColor = "red";
      title = `${texts[alertType].companyChangedUser.title[0]}`;

      break;
    }

    case "alert_add_worker_company": {
      alertColor = "red";
      title = `${texts[alertType].companyChangedUser.title[0]}`;

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
  const linkName = texts.general.linkName;

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
    linkName: linkName,
  };
};
