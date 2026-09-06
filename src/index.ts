import SteamUser from "steam-user";
import SteamCommunity from "steamcommunity";
import TradeOfferManager from "steam-tradeoffer-manager";
import SteamTotp from "steam-totp";
import dotenv from "dotenv";

dotenv.config();

const client = new SteamUser();
const community = new SteamCommunity();
const manager = new TradeOfferManager({
    steam: client,
    community: community,
    language: "en",
    useAccessToken: true,
});

const logOnOptions = {
    accountName: process.env.STEAM_USERNAME!,
    password: process.env.STEAM_PASSWORD!,
    twoFactorCode: SteamTotp.generateAuthCode(process.env.STEAM_SHARED_SECRET!),
};

client.logOn(logOnOptions);

client.on("loggedOn", () => {
    console.log("✅ Bot logged into Steam!");
    client.setPersona(SteamUser.EPersonaState.Online);
});

client.on("webSession", (sessionID, cookies) => {
    manager.setCookies(cookies, (err) => {
        if (err) {
            console.error("❌ Error setting cookies:", err);
            process.exit(1);
        }
        console.log("🍪 Cookies set!");
    });

    community.setCookies(cookies);
    community.startConfirmationChecker(10000, process.env.IDENTITY_SECRET!);
});

manager.on("newOffer", (offer) => {
    if (offer.isGlitched() || offer.state !== TradeOfferManager.ETradeOfferState.Active) {
        console.log("❌ Invalid or already completed offer.");
        return;
    }

    const itemsToGive = offer.itemsToGive;
    const itemsToReceive = offer.itemsToReceive;

    if (itemsToGive.length > 0) {
        console.log(`❌ Cancelling offer from ${offer.partner.getSteamID64()} because there are items from your side.`);
        offer.decline();
        return;
    }

    if (itemsToReceive.length === 0) {
        console.log(`❌ Declining offer from ${offer.partner.getSteamID64()} because there are no received items.`);
        offer.decline();
        return;
    }

    console.log(`✅ Accepting trade offer from ${offer.partner.getSteamID64()} with received items.`);
    offer.itemsToReceive.forEach((item) => {
        console.log(`(${item.appid})`);
        console.log(`${item.getLargeImageURL()}`);
        console.log(`${item.name}`);
    });
    offer.accept((err) => {
        if (err) {
            console.error("❌ Error accepting the offer:", err);
            return;
        }
        console.log("✅ Offer accepted successfully!");
        community.checkConfirmations();
    });
});
