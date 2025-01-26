import { useState, useEffect } from "react";
import styled from "styled-components";

const CheckboxWrapper = styled.div`
    .checkbox-container {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 10px;
        border-radius: 8px;
        background: rgb(50, 50, 50);
        color: white;
    }

    input[type="checkbox"] {
        width: 18px;
        height: 18px;
        border: 1px solid rgb(100, 100, 100);
        border-radius: 4px;
        background: rgb(50, 50, 50);
        cursor: pointer;
        transition: border-color 0.2s ease;

        &:checked {
            background: rgb(150, 150, 150);
        }

        &:focus {
            outline: none;
            border-color: rgb(150, 150, 150);
        }
    }

    label {
        font-size: 16px;
        user-select: none;
    }
`;

export function Checkbox({ label = "Checkbox", onChange, value = false }) {
    const [checked, setChecked] = useState(value);

    const handleCheckboxChange = (e) => {
        setChecked(e.target.checked);
        onChange?.(e.target.checked);
    };

    useEffect(() => {
        setChecked(value);
    }, [value]);

    return (
        <CheckboxWrapper>
            <div className="checkbox-container">
                <input
                    type="checkbox"
                    checked={checked}
                    onChange={handleCheckboxChange}
                />
                <label>{label}</label>
            </div>
        </CheckboxWrapper>
    );
}
