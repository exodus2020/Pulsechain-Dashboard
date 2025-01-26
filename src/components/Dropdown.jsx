import { useState } from "react";
import styled from "styled-components";
import Button from "./Button";

const DropdownWrapper = styled.div`
    .dropdown-container {
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 10px;
        align-items: center;
        padding: 10px;
        border-radius: 8px;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }

    select {
        width: 100%;
        padding: 10px;
        font-size: 16px;
        border: 1px solid rgb(100, 100, 100);
        border-radius: 4px;
        transition: border-color 0.2s ease;
        background: rgb(50, 50, 50);
        color: white;

        &:focus {
            outline: none;
            border-color: rgb(150, 150, 150);
        }
    }
`;

export function Dropdown({ onSubmit, onChange, defaultOption = "All", options = [], disabled = false, buttonText = "Select", hideButton = true
}) {
    const [selectedOption, setSelectedOption] = useState(defaultOption);

    const handleOptionChange = (e) => {
        setSelectedOption(e.target.value);
        onChange?.(e.target.value);
    };

    const handleSubmit = () => {
        if (onSubmit) {
            onSubmit(selectedOption);
        }
    };

    return (
        <DropdownWrapper>
            <div className="dropdown-container">
                <div style={{ paddingRight: 20 }}>
                    <select
                        value={selectedOption}
                        onChange={handleOptionChange}
                        disabled={disabled}
                    >
                        {[defaultOption, ...options]
                            .filter((value, index, self) => self.indexOf(value) === index)
                            .map((option, index) => (
                                <option key={index} value={option}>
                                    {option}
                                </option>
                            ))}
                    </select>
                </div>
                {!hideButton ? <Button onClick={handleSubmit} disabled={disabled}>
                    {buttonText}
                </Button> : ''}
            </div>
        </DropdownWrapper>
    );
}
