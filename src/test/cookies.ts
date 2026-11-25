// The cookies a response sets, as the browser sends them back: the Cookie
// header of the next request.
export function cookiesOf(response: Response) {
  return response.headers
    .getSetCookie()
    .map((setCookie) => setCookie.split(";")[0])
    .join("; ");
}
