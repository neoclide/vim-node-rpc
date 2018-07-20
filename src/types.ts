
/**
 * 1 => request id
 * 2 => method name
 * 3 => arguments
 */
type RequestMessage = [0, number, string, any[]]


/**
 * 1 => request id
 * 2 => error
 * 3 => result
 */
type ResponseMessage = [1, number, any|null, any|null]


/**
 * 1 => event name
 * 2 => arguments
 */
type NotificationMessage = [2, string, any[]]

// could also be income and outcome.
type Message = RequestMessage | ResponseMessage | NotificationMessage

