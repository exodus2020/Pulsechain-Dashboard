import { icons_list } from "./icons"

export const menuOptions = [
    {
        name: "Wallets",
        icon: icons_list.wallet,
        action: 'to_home',
        activePath: ''
    },
    {
        name: "Activity",
        icon: icons_list.activity,
        action: 'to_activities',
        activePath: 'activities'
    },
    {
        name: "dApps",
        icon: icons_list.apps,
        action: 'dapps'
    },
    {
        name: 'Settings',
        icon: icons_list.settings,
        action: 'settings'
    },
]

