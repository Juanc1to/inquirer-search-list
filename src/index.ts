import Base = require("inquirer/lib/prompts/base");
import observe = require("inquirer/lib/utils/events");
import figures = require("figures");
import Paginator = require("inquirer/lib/utils/paginator");
import chalk from "chalk";
import * as fuzzy from "fuzzy";
import * as Inquirer from "inquirer";

interface Event {
  key: {
    name: string;
    ctrl: boolean;
    meta: boolean;
  };
  value: string;
}

// renderer is used to _display_ a row
type Renderer = (item: Item, isSelected: boolean) => string;
// filterer is used to _fuzzy search_ a row
// it's separate from renderer so you can search for non-visible text!
type Filterer = (item: Item, query: string) => boolean;

interface Item extends Base.Item {
  id: number;
}

const ignoreKeys = ['up', 'down', 'space'];

function defaultFilterRow(choice: Item, query: string) {
  return fuzzy.test(query, choice.name);
};

function defaultRenderRow(choice: Item, isSelected: boolean) {
  if(isSelected) {
    return `${chalk.cyan(figures.pointer)}${chalk.cyan(choice.name)}`;
  } else {
    return ` ${choice.name}`;
  }
}

function renderChoices(renderRow: Renderer, choices: Item[], pointer: number) {
	var output = "";

	choices.forEach(function(choice, i) {
  	output += renderRow(choice, i === pointer);
		output += "\n";
	});

  return output.replace(/\n$/, '');
}

class SearchBox extends Base {
	private pointer: number = 0;
  private defaultValue: any = undefined;
	private selected: string | undefined = '';
	// @ts-ignore
  private done: (state: any) => void;
	private list: Item[] = [];
	private filterList: Item[] = [];
	private paginator: Paginator = new Paginator();
	private userInput: string | undefined = '';
  private renderRow: Renderer;
  private filterRow: Filterer;

	constructor(...params: Inquirer.Question[]) {
		super(...params);
		const { choices, renderRow, filterRow } = this.opt;
    this.defaultValue = this.opt.default;

		if (!choices) {
			this.throwParamError('choices');
		}

  	renderRow ? this.renderRow = renderRow : this.renderRow = defaultRenderRow;
  	filterRow ? this.filterRow = filterRow : this.filterRow = defaultFilterRow;

    const ob = this;
		this.filterList = this.list = choices
			.filter(() => true) // fix slice is not a function
			.map(function (item, id) {
        if (item.value === ob.defaultValue) {
          ob.pointer = id;
        }
        return {
          ...item,
          id,
        };
      });
	}

  render(error?: string) {
    // Render question
    var message = this.getQuestion();
    var bottomContent = '';
    const tip = chalk.dim('(Press <enter> to submit)');

    // Render choices or answer depending on the state
    if (this.status === 'answered') {
      message += chalk.cyan(this.selected ? this.selected : '');
    } else {
      message += `${tip} ${this.rl.line}`;
			const choicesStr = renderChoices(
        this.renderRow,
        this.filterList,
        this.pointer,
      );
      bottomContent = this.paginator.paginate(
        choicesStr,
        this.pointer,
        this.opt.pageSize,
      );
    }

    if (error) {
      bottomContent = chalk.red('>> ') + error;
    }

    this.screen.render(message, bottomContent);
  }

  filterChoices() {
    const options = {
      extract: (el: Item) => el.name,
    };

    // was:
    //this.filterList = this.list.filter((choice) => this.filterRow(choice, this.rl.line));
    // TODO: evaluate these two different approaches.
    const ob = this;
    this.filterList = fuzzy.filter(this.rl.line, this.list, options).map(
      function (el, index) {
        if (el.original.value === ob.defaultValue) {
          ob.pointer = index;
        }
        return el.original;
      }
    );
    // 记录输入值: "record input value"? Ah, I think to allow providing an
    // input that is not one of the available options.
		this.userInput = this.rl.line;
  }

  onDownKey() {
    const len = this.filterList.length;
    this.pointer = this.pointer < len - 1 ? this.pointer + 1 : 0;
    this.render();
  }

  onUpKey() {
    const len = this.filterList.length;
    this.pointer = this.pointer > 0 ? this.pointer - 1 : len - 1;
    this.render();
  }

  onAllKey() {
    this.render();
  }

  onEnd(state: any) {
    this.status = 'answered';
    if (this.getCurrentItemName()) {
      this.selected = this.getCurrentItemName();
    }
    // Rerender prompt (and clean subline error)
    this.render();

    this.screen.done();
    this.done(state.value);
  }

  onError(state: any) {
    this.render(state.isValid);
  }

  onKeyPress() {
    this.pointer = 0;
    this.filterChoices();
    this.render();
  }

  getCurrentItem() {
    if (this.filterList.length) {
      return this.filterList[this.pointer];
    }
    // other version:
    //return this.list[this.pointer];
    // TODO: evaluate these two different approaches
		return {
      value: this.userInput,
      name: this.userInput,
      short: this.userInput,
      disabled: false,
    };

    // TODO: also, what's all this unreachable code?
    /*this.filterList = this.list = choices
      .filter(() => true) // fix slice is not a function
      .map((item, id) => ({ ...item, id }));
    // init default value
    const index = this.filterList.findIndex((e) => {
      return e.name === this.opt.default;
    });
    this.pointer = index > -1 ? index : 0;*/
  }

  getCurrentItemValue() {
    return this.getCurrentItem().value;
  }

  getCurrentItemName() {
    return this.getCurrentItem().name;
  }

  _run(cb: any) {
    this.done = cb;

    const events = observe(this.rl);
    const upKey = events.keypress.filter((e: Event) => e.key.name === 'up' || (e.key.name === 'p' && e.key.ctrl));
    const downKey = events.keypress.filter((e: Event) => e.key.name === 'down' || (e.key.name === 'n' && e.key.ctrl));
    const allKey = events.keypress.filter((e: Event) => e.key.name === 'o' && e.key.ctrl);
    const validation = this.handleSubmitEvents(events.line.map(this.getCurrentItemValue.bind(this)));

    validation.success.forEach(this.onEnd.bind(this));
    validation.error.forEach(this.onError.bind(this));
    upKey.forEach(this.onUpKey.bind(this));
    downKey.forEach(this.onDownKey.bind(this));
    allKey.takeUntil(validation.success).forEach(this.onAllKey.bind(this));
    events.keypress
      .filter((e: Event) => !e.key.ctrl && !ignoreKeys.includes(e.key.name))
      .takeUntil(validation.success)
      .forEach(this.onKeyPress.bind(this));

    this.render();
    return this;
  }
}

export = SearchBox;
