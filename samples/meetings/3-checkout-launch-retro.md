# Checkout launch retro

Date: 2026-10-21
Facilitator: Marcus Lee

Priya Shah (00:00:06): Welcome to the retro for the checkout launch. Let's start with the numbers and then go through what went well and what didn't.
Priya Shah (00:00:15): We launched yesterday at 10am at 10 percent, ramped to 50 percent at 2pm and to 100 percent this morning. Mobile conversion over the first 24 hours is 43 percent, up from 38. Payment error rate on the card step dropped from 9 percent to 3.5.
Lena Ortiz (00:00:39): That's a great start. The single page layout is clearly doing its job.
Tom Becker (00:00:47): The not so great part: between roughly 2:10 and 4:05pm we had failed payments for Maestro cards. About 140 orders. The 3D Secure challenge completed, but our webhook handler rejected the event because Maestro sends a different payment method type that we didn't map.
Marcus Lee (00:01:12): And we didn't catch it because none of our staging test cards were Maestro. That's on the test plan, we only covered Visa and Mastercard challenge flows.
Priya Shah (00:01:24): How did we find out?
Tom Becker (00:01:27): Support tickets, honestly. The dashboards showed the error rate going up, but there was no alert on it. I noticed it at about 3:50 and flipped the feature flag for EU traffic.
Lena Ortiz (00:01:44): So the kill switch worked, it was just late.
Tom Becker (00:01:48): Exactly. Fix went out at 6pm and we turned EU back on.
Priya Shah (00:01:55): What about the customers who failed?
Tom Becker (00:01:59): Support emailed all 140 with a discount code. 61 already completed the purchase.
Marcus Lee (00:02:10): Okay, what went well? I'll start: the webhook based confirmation itself worked. Zero cancelled orders from 3D Secure timeouts, which was the big risk from planning.
Lena Ortiz (00:02:24): The handoff went smoothly. Tom's team built it almost pixel perfect from the designs.
Priya Shah (00:02:32): And the date held. Moving to the 20th was the right call.
Marcus Lee (00:02:40): What should we change?
Tom Becker (00:02:43): Alerting. We need an alert on payment error rate, not just a dashboard. I'd say page the on-call if the card step error rate goes above 6 percent for 10 minutes.
Priya Shah (00:02:58): Agreed. We've decided that payment error rate alerting is a launch requirement for any future payments work.
Marcus Lee (00:03:08): And test coverage. I'll add Maestro, Amex and Cartes Bancaires challenge flows to the regression suite by October 24.
Tom Becker (00:03:18): I'll write the incident postmortem for the Maestro outage by Thursday, and I'll set up the error rate alert today.
Lena Ortiz (00:03:28): On the design side, I want to run five usability sessions on the new checkout with real customers next week, especially on the order summary change.
Priya Shah (00:03:39): Good. Last topic, address autocomplete. Is it still the November fast follow?
Tom Becker (00:03:45): Yes, now that 3D Secure is done we can start it in sprint 16.
Priya Shah (00:03:51): Then let's confirm it: autocomplete starts in sprint 16. I'll share the launch metrics with leadership on Friday, including the Maestro incident.
Marcus Lee (00:04:04): Anything else? No? Then thanks everyone, good launch overall.
