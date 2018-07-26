const crypto = require('crypto')
const Trello = require("trello")

function signRequestBody(key, body) {
  return `sha1=${crypto.createHmac('sha1', key).update(body, 'utf-8').digest('hex')}`
}

// assoc array of cards per board boardId -> []
const cardCache = {
}

function addCommentToTrello(t, trelloBoard, trelloCard, comment, author, timestamp, url, callback) {
  var onCardsFound = (function (l) {
    console.log(`Found ${l.length} cards on board ${trelloBoard}`)
    var cardId = null
    
    if (trelloCard != null && l != null) {
      for (var i = 0; i < l.length; i++) {
        if (l[i].idShort == trelloCard) {
          cardId = l[i].id
          break
        }
      }
    } else 
    if (l == null) {
      console.log(`Can not find board cards: ${trelloBoard}`)
      return callback(false)
    }
    
    if (comment != null && cardId != null) {
      var fmt = "__" + timestamp + " [commit](" +  url + ") by " + author + ":__\n" + comment + "\n"
      console.log(`Adding comment: ${fmt} to card: ${cardId}`)
      t.addCommentToCard(cardId, fmt, function () {
        console.log("Comment added...")
        return callback(true)
      })
    } else
    if (cardId == null) {
      console.log(`Can not find card ${trelloCard} on board: ${trelloBoard}`)
      return callback(false)
    } else
    if (comment == null) {
      console.log("No comment found in payload")
      return callback(false)
    }
  })

  // Cache cards
  if (cardCache[trelloBoard]) {
    onCardsFound(cardCache[trelloBoard])
  } else {
    t.getCardsOnBoard(trelloBoard, function (arg, l) {
      cardCache[trelloBoard] = l
      onCardsFound(l)
    })
  }
}

function parseCommentAndAdd(t, trelloBoard, trelloCardPrefix, comment, author, timestamp, url, callback) {
  var reg = [ /\[([a-zA-Z-0-9\#]+)\](.*)/, /^([a-zA-Z-0-9\#]+):(.*)/ ]
  var matched = false;
  for (var i = 0; i < reg.length; i++) {
    var res = reg[i].exec(comment)
    if (res) {
      var trelloCard = res[1]
      comment = res[2]
      console.log(`Found reference to card: ${trelloCard} with comment: ${comment}`)
      if (trelloCard.startsWith(trelloCardPrefix)) {
        trelloCard = trelloCard.substring(trelloCardPrefix.length)
        addCommentToTrello(t, trelloBoard, trelloCard, comment.trim(), author, timestamp, url, callback)
      } else {
        console.log(`Trello card ${trelloCard} does not start with prefix: ${trelloCardPrefix}`)
      }
      matched = true;
      break;
    }
  }

  if (!matched) {
    console.log(`Comment does not match known card reference patterns: ${comment}`)
  }
}

function githubCleanupComment(s) {
  s = s.replace(/\+/g, " ");
  s = s.replace(/\\n/g, " ");
  s = s.trim();
  return s;
}

module.exports.githubWebhookListener = (event, context, callback) => {
  var errMsg // eslint-disable-line
  const token = process.env.GITHUB_WEBHOOK_SECRET
  const trelloToken = process.env.TRELLO_TOKEN
  const trelloKey = process.env.TRELLO_KEY
  const trelloBoard = process.env.TRELLO_BOARD
  const trelloCardPrefix = process.env.TRELLO_CARD_PREFIX
  const headers = event.headers
  const sig = headers['X-Hub-Signature']
  const githubEvent = headers['X-GitHub-Event']
  const id = headers['X-GitHub-Delivery']
  const calculatedSig = signRequestBody(token, event.body)

  if (typeof token !== 'string') {
    errMsg = 'Must provide a \'GITHUB_WEBHOOK_SECRET\' env variable'
    return callback(null, {
      statusCode: 401,
      headers: { 'Content-Type': 'text/plain' },
      body: errMsg,
    })
  }

  if (typeof trelloToken !== 'string') {
    errMsg = 'Must provide a \'TRELLO_TOKEN\' env variable'
    return callback(null, {
      statusCode: 401,
      headers: { 'Content-Type': 'text/plain' },
      body: errMsg,
    })
  }

  if (typeof trelloKey !== 'string') {
    errMsg = 'Must provide a \'TRELLO_KEY\' env variable'
    return callback(null, {
      statusCode: 401,
      headers: { 'Content-Type': 'text/plain' },
      body: errMsg,
    })
  }

  if (!sig) {
    errMsg = 'No X-Hub-Signature found on request'
    return callback(null, {
      statusCode: 401,
      headers: { 'Content-Type': 'text/plain' },
      body: errMsg,
    })
  }

  if (!githubEvent) {
    errMsg = 'No X-Github-Event found on request'
    return callback(null, {
      statusCode: 422,
      headers: { 'Content-Type': 'text/plain' },
      body: errMsg,
    })
  }

  if (!id) {
    errMsg = 'No X-Github-Delivery found on request'
    return callback(null, {
      statusCode: 401,
      headers: { 'Content-Type': 'text/plain' },
      body: errMsg,
    })
  }

  if (sig !== calculatedSig) {
    errMsg = 'X-Hub-Signature incorrect. Github webhook token doesn\'t match'
    return callback(null, {
      statusCode: 401,
      headers: { 'Content-Type': 'text/plain' },
      body: errMsg,
    })
  }

  /* eslint-disable */
  console.log('---------------------------------')
  console.log(`Github-Event: "${githubEvent}" with action: "${event.body.action}"`)
  console.log('---------------------------------')

  if (typeof event.body == "string") {
    const PAYLOAD_TOKEN = "payload="
    if (event.body.startsWith(PAYLOAD_TOKEN)) {
      event.body = event.body.substring(PAYLOAD_TOKEN.length)
      event.body = decodeURIComponent(event.body)
      event.body = JSON.parse(event.body)
    }
  }
  console.log('Payload', event.body)
  /* eslint-enable */

  const response = {
    statusCode: 200,
    body: JSON.stringify({
      input: event,
    }),
  }

  var t = new Trello(trelloKey, trelloToken)

  if (event.body && event.body.comment && event.body.comment.body) {
    var comment = event.body.comment.body
    parseCommentAndAdd(t, trelloBoard, trelloCardPrefix, githubCleanupComment(comment), "?", "?", "?", function () {})
  } else 
  if (event.body && event.body.commits) {
    for (var i = 0; i < event.body.commits.length; i++) {
      var commit = event.body.commits[i]
      parseCommentAndAdd(t, trelloBoard, trelloCardPrefix, githubCleanupComment(commit.message), 
        githubCleanupComment(commit.author.name), commit.timestamp, commit.url, function () {})
    }
  } else {
    console.log("Can not find comment in payload")
  }
  
  return callback(null, response)
}
