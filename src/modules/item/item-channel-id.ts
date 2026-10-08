/** Parses item_<qrCodeId>_<finderUserId>, allowing underscores in qrCodeId. */
export function parseItemChannelId(
  channelId: string
): { qrCodeId: string; finderId: string } | null {
  if (!channelId.startsWith("item_")) return null;
  const separator = channelId.lastIndexOf("_");
  if (separator <= 5 || separator === channelId.length - 1) return null;
  return {
    qrCodeId: channelId.slice(5, separator),
    finderId: channelId.slice(separator + 1),
  };
}
