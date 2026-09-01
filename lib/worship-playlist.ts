/**
 * ============================================================
 * WORSHIP PLAYLIST - Church for Truckers' seed set
 * ============================================================
 *
 * THIS IS TENANT DATA LIVING IN CODE, AND IT IS TEMPORARY.
 *
 * Thirty songs, ported verbatim from the YourLife CC project
 * (app/js/worship.js) where they were hand-curated. They belong to Church for
 * Truckers, not to the platform, and every other church needs its own.
 *
 * They are here, in one file that contains nothing else, so that moving them to
 * a per-church table later is a LIFT rather than an untangling. The rule that
 * makes that possible: nothing imports individual songs, and no rendering code
 * inlines one. components/site/worship-grid.tsx takes a WorshipSong[] and does
 * not care where it came from - point it at a database query and this file is
 * deleted with nothing else to change.
 *
 * WHY NOT A YOUTUBE PLAYLIST ID. There isn't one. The YourLife project had no
 * playlist, only this array - checked before porting. A playlist id would
 * auto-update and would fit church_links; a frozen list does not, which is
 * exactly why it is not being forced into that table.
 *
 * The artist and duration are HAND-WRITTEN metadata, not API output. YouTube's
 * API returns neither in the form shown here, so they cannot be regenerated -
 * losing them would mean losing work somebody actually did.
 *
 * Extracted programmatically rather than retyped: 30 parsed, 30 unique ids,
 * every id 11 characters. See the commit message for the verification.
 */

/** One song. The shape is the YourLife record, unchanged. */
export type WorshipSong = {
  /** YouTube video id. */
  id: string;
  title: string;
  artist: string;
  /** As written by hand, e.g. "5:50". Never parsed - only displayed. */
  duration: string;
};

/**
 * The category this set belongs to on /worship.
 *
 * The page's seeded filters are "Worship sets" (music) and "Driver Stories"
 * (stories). These songs are worship sets, so they answer to `music` and are
 * correctly absent from the Driver Stories filter. No new filter was invented.
 */
export const WORSHIP_CATEGORY = "music";

export const WORSHIP_PLAYLIST: WorshipSong[] = [
  { id: "iJCV_2H9xD0", title: "Way Maker", artist: "Sinach", duration: "5:50" },
  { id: "-f4MUUMWMV4", title: "Goodness of God", artist: "Bethel Music", duration: "6:32" },
  { id: "nQWFzMvCfLE", title: "What a Beautiful Name", artist: "Hillsong Worship", duration: "4:04" },
  { id: "Sc6SSHuZvQE", title: "Reckless Love", artist: "Cory Asbury", duration: "5:19" },
  { id: "r2zhf2mqEMI", title: "Come As You Are", artist: "Crowder", duration: "3:42" },
  { id: "TCunuL58odQ", title: "How He Loves", artist: "David Crowder Band", duration: "5:50" },
  { id: "dy9nwe9_xzw", title: "Oceans (Where Feet May Fail)", artist: "Hillsong United", duration: "8:58" },
  { id: "u-1fwZtKJSM", title: "Living Hope", artist: "Phil Wickham", duration: "5:03" },
  { id: "KBD18rsVJHk", title: "How Great Is Our God", artist: "Chris Tomlin", duration: "4:09" },
  { id: "2go_dOJVwc4", title: "Raise a Hallelujah", artist: "Bethel Music", duration: "5:40" },
  { id: "XtwIT8JjddM", title: "10,000 Reasons", artist: "Matt Redman", duration: "5:52" },
  { id: "LqBpifDpNKc", title: "O Praise the Name", artist: "Hillsong Worship", duration: "5:49" },
  { id: "PcmqSfr1ENY", title: "I Speak Jesus", artist: "Here Be Lions", duration: "4:37" },
  { id: "mC-zw0zCCtg", title: "Jireh", artist: "Elevation Worship & Maverick City", duration: "5:32" },
  { id: "16KYvfIc2bE", title: "In Christ Alone", artist: "Keith Getty & Stuart Townend", duration: "4:24" },
  { id: "P-Zp586pvZg", title: "The Heart of Worship", artist: "Matt Redman", duration: "4:37" },
  { id: "EbMYye-2Yt8", title: "Holy Forever", artist: "Jen Johnson", duration: "8:14" },
  { id: "Ak5WTb-mgeA", title: "Worthy", artist: "Elevation Worship", duration: "6:09" },
  { id: "o8Gds6lBick", title: "Mighty Name of Jesus", artist: "Feat. Hope Darst", duration: "7:57" },
  { id: "YJNFAaWJhp0", title: "Hard Fought Hallelujah", artist: "Brandon Lake, Jelly Roll", duration: "5:31" },
  { id: "f2oxGYpuLkw", title: "Praise", artist: "Brandon Lake | Elevation Worship", duration: "5:04" },
  { id: "LawxIZE9ePE", title: "Same God", artist: "Elevation Worship", duration: "8:01" },
  { id: "cej4vn4sWtE", title: "Jesus Be The Name", artist: "Elevation Worship", duration: "8:59" },
  { id: "uHz0w-HG4iU", title: "Great Are You Lord", artist: "All Sons & Daughters", duration: "5:01" },
  { id: "dQdfs5S6jyA", title: "Gratitude", artist: "Brandon Lake", duration: "5:41" },
  { id: "jzQvggUparA", title: "Firm Foundation", artist: "The Belonging Co", duration: "7:55" },
  { id: "LM1qrx0Huds", title: "I Thank God", artist: "Tribl", duration: "8:07" },
  { id: "sIaT8Jl2zpI", title: "You Say", artist: "Lauren Daigle", duration: "4:30" },
  { id: "NXRR4fb_5HI", title: "Let It Be A Hallelujah", artist: "Lauren Daigle", duration: "4:07" },
  { id: "6DjKbUQfe9U", title: "No One Like The Lord", artist: "Jenn Johnson", duration: "8:18" },
];
