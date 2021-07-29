const AllTranslates = require("./Translates");

const generateAlertFromProps = ({
  title = null,
  day = null,
  hours = null,
  reserwation = null,
  service = null,
  communiting = null,
  defaultText = null,
  texts,
}) => {
  const dayText = texts.general.dayText;
  const hoursText = texts.general.hoursText;
  const reserwationText = texts.general.reserwationText;
  const serviceText = texts.general.serviceText;
  const communitingText = texts.general.communitingText;
  const styleInline = { display: "inline-block" };
  const styleInlineBold = { fontWeight: "bold", display: "inline-block" };
  const styleInlineBoldCapitalize = {
    fontWeight: "bold",
    display: "inline-block",
    textTransform: "capitalize",
  };
  return `<div>
      {!!title && (
        <div style={{ fontWeight: "bold", display: "inline-block" }}>
          {title}
        </div>
      )}
      {!!day && (
        <div style={styleInline}>
          {dayText}: <div style={styleInlineBold}>{day},</div>
        </div>
      )}
      {!!hours && (
        <div style={styleInline}>
          {hoursText}: <div style={styleInlineBold}>{hours},</div>
        </div>
      )}
      {!!reserwation && (
        <div style={styleInline}>
          {reserwationText}: <div style={styleInlineBold}>{reserwation}</div>
        </div>
      )}
      {!!service && (
        <div style={styleInline}>
          {serviceText}: <div style={styleInlineBold}>{service}</div>
        </div>
      )}
      {!!communiting && (
        <div style={styleInline}>
          {communitingText}:{" "}
          <div style={styleInlineBoldCapitalize}>{communiting}</div>
        </div>
      )}
      {!!defaultText && <div style={styleInlineBold}>{defaultText}</div>}
    </div>`;
};

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
  let city = "None";
  let companyName = "Brak firmy";
  let companyLink = null;
  let title = null;
  let day = null;
  let hours = null;
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
      city = alertDate.city;
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

  return {
    alertColor: alertColor,
    title: title,
    day: day,
    hours: hours,
    reserwation: reserwation,
    service: service,
    communiting: communiting,
    city: city,
    alertDate: alertDate,
    timeStartEnd: timeStartEnd,
    companyLink: companyLink,
  };
};
