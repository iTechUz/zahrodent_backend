"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const nest_commander_1 = require("nest-commander");
const commands_module_1 = require("./commands/commands.module");
async function bootstrap() {
    await nest_commander_1.CommandFactory.run(commands_module_1.CommandsModule, {
        logger: console
    });
}
bootstrap();
//# sourceMappingURL=main-command.js.map