# Real-device checklist

The automated tests emulate touch and viewport sizes in Chromium. They cannot see what a real phone does. Before a release that changes layout, motion or the service worker, run through this on at least one iPhone (Safari) and one Android phone (Chrome), in dark and light themes, and note the device and OS.

## Layout and touch
- [ ] Every page opens from the bottom dock and the slide-in menu; no sideways scrolling anywhere.
- [ ] The dock hides when scrolling down and returns when scrolling up; it never covers a button.
- [ ] Tap targets are comfortable (nothing needs two tries); the indicator drawer opens, scrolls and closes.
- [ ] Charts: vertical scrolling still works when the finger starts on a chart; a horizontal drag zooms; the reset label works.
- [ ] Text stays readable with the system font size set to large.
- [ ] Rotating the phone redraws charts at the new width.

## Features
- [ ] First-run tour appears once, traps focus, and can be closed; "Take the quick tour" replays it.
- [ ] Copy link, Export CSV, All history and History CSV download or copy as expected (some in-app browsers block downloads; say which).
- [ ] Watchlist add and remove with Undo, toast swipe-to-dismiss.

## Docs page
- [ ] The document chips scroll sideways, the filter box works with the on-screen keyboard open, and choosing a document scrolls to its title.
- [ ] The reading-progress bar and the quick links under the guide title behave; no text is clipped.

## Offline and install
- [ ] Load the site online, switch to airplane mode, reload: the last data shows with an offline notice.
- [ ] Add to Home Screen: the icon, name and colours are correct.

## Accessibility
- [ ] VoiceOver or TalkBack reads each status as a word (never only a colour) and reads the drawer title when it opens.
- [ ] Reduce Motion in system settings turns off the number ticker, slider and toast animation.

Record findings as GitHub issues with the device, OS and browser version. Nothing on this list has been run on a real device yet.
